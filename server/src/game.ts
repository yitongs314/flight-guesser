import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { buildClues } from './clues';
import { airportLabel, airportsByIcao, airlinesByIcao, typesByIcao } from './data';
import { fetchLiveSnapshot, pickFlight } from './flightPicker';
import type {
  ClueOffer,
  Feedback,
  FlightRecord,
  FlightStateDTO,
  GameDTO,
  Guess,
  Mode,
  Photo,
  Reveal,
  Scoring,
} from './types';
import { HttpError, bearingIndex, haversineKm } from './util';

const BASE = 1000;
const TILE_PRICE = 50;
const WRONG_COST = 50;
const FLOOR = 100;
const TILE_COLS = 6;
const TILE_ROWS = 4;

// Fill-the-Flight has three hidden fields to find, so it gets more strikes.
function strikesFor(mode: Mode): number {
  return mode === 'fill' ? 5 : 3;
}

class PhotoUnavailable extends Error {}

interface PhotoBoardData {
  image: Buffer;
  width: number;
  height: number;
  cols: number;
  rows: number;
  tileCache: Map<number, Buffer>;
}

interface FlightSession {
  flight: FlightRecord;
  clues: ReturnType<typeof buildClues>;
  /** Purchased clue indices (or tile indices in photo mode), in buy order. */
  purchased: number[];
  wrongGuesses: number;
  status: 'playing' | 'solved' | 'failed';
  locked: { origin?: boolean; destination?: boolean; airline?: boolean; type?: boolean };
  feedback: Feedback[];
  reveal: Reveal | null;
  board: PhotoBoardData | null;
}

/**
 * Everything needed to start a flight session. In two-player rooms one seed is
 * shared by both players, so they face the identical flight, clue shop (same
 * hint draw), photo board, and fill-mode given field.
 */
export interface SessionSeed {
  flight: FlightRecord;
  clues: ReturnType<typeof buildClues>;
  board: PhotoBoardData | null;
  fillGiven?: 'origin' | 'destination' | 'airline' | 'type';
}

export type SeedProvider = (flightIndex: number) => Promise<SessionSeed>;

export interface Game {
  id: string;
  mode: Mode;
  scoring: Scoring;
  flightCount: number;
  flightIndex: number;
  totalScore: number;
  usedHexes: Set<string>;
  /** When set (rooms), flights come from the shared provider, not pickFlight. */
  provider?: SeedProvider;
  /** Daily-flight games: which day this attempt belongs to. */
  dailyDay?: number;
  dailyName?: string;
  dailyRecorded?: boolean;
  current: FlightSession;
  past: Reveal[];
  lastTouched: number;
}

const games = new Map<string, Game>();

setInterval(() => {
  const cutoff = Date.now() - 12 * 3600 * 1000;
  for (const [id, game] of games) {
    if (game.lastTouched < cutoff) games.delete(id);
  }
}, 30 * 60 * 1000).unref();

const photoCache = new Map<string, Photo | null>();

async function fetchPhoto(registration: string): Promise<Photo | null> {
  // Planespotters requires a User-Agent that includes a contact URL or email.
  // Set PHOTO_CONTACT in server/.env (gitignored); photos are skipped without it.
  const contact = process.env.PHOTO_CONTACT;
  if (!registration || !contact) return null;
  const cached = photoCache.get(registration);
  if (cached !== undefined) return cached;
  let photo: Photo | null = null;
  try {
    const res = await fetch(
      `https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(registration)}`,
      {
        signal: AbortSignal.timeout(6000),
        headers: { 'user-agent': `flight-guesser/0.1 (+${contact})` },
      },
    );
    if (res.ok) {
      const body = (await res.json()) as {
        photos?: {
          thumbnail_large?: { src?: string };
          thumbnail?: { src?: string };
          photographer?: string;
          link?: string;
        }[];
      };
      const p = body.photos?.[0];
      const src = p?.thumbnail_large?.src ?? p?.thumbnail?.src;
      if (src) photo = { url: src, photographer: p?.photographer ?? '', link: p?.link ?? '' };
    }
  } catch {
    // photo is a nice-to-have; play on without it
  }
  photoCache.set(registration, photo);
  return photo;
}

async function buildSeed(flight: FlightRecord, mode: Mode): Promise<SessionSeed> {
  let board: PhotoBoardData | null = null;
  if (mode === 'photo') {
    const photo = await fetchPhoto(flight.registration);
    if (!photo) throw new PhotoUnavailable();
    let image: Buffer;
    let width: number | undefined;
    let height: number | undefined;
    try {
      const res = await fetch(photo.url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new PhotoUnavailable();
      image = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(image).metadata();
      width = meta.width;
      height = meta.height;
    } catch {
      throw new PhotoUnavailable();
    }
    if (!width || !height) throw new PhotoUnavailable();
    board = { image, width, height, cols: TILE_COLS, rows: TILE_ROWS, tileCache: new Map() };
  }
  const seed: SessionSeed = { flight, clues: buildClues(flight, mode), board };
  if (mode === 'fill') {
    // One of the four facts is given for free; the rest must be deduced.
    const fields = ['origin', 'destination', 'airline', 'type'] as const;
    seed.fillGiven = fields[Math.floor(Math.random() * fields.length)];
  }
  return seed;
}

function sessionFromSeed(seed: SessionSeed): FlightSession {
  return {
    flight: seed.flight,
    clues: seed.clues,
    purchased: [],
    wrongGuesses: 0,
    status: 'playing',
    locked: seed.fillGiven ? { [seed.fillGiven]: true } : {},
    feedback: [],
    reveal: null,
    board: seed.board,
  };
}

export async function makeSeed(mode: Mode, usedHexes: Set<string>): Promise<SessionSeed> {
  if (mode === 'photo' && !process.env.PHOTO_CONTACT) {
    throw new HttpError(
      503,
      'Photo mode needs PHOTO_CONTACT set in server/.env (used for the Planespotters API User-Agent).',
      'NO_PHOTO_CONTACT',
    );
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const flight = await pickFlight(usedHexes);
    try {
      return await buildSeed(flight, mode);
    } catch (e) {
      if (e instanceof PhotoUnavailable) continue;
      throw e;
    }
  }
  throw new HttpError(
    503,
    'Could not find a live flight with a usable photo — try again in a minute.',
    'NO_PHOTO_FLIGHT',
  );
}

function spent(game: Game): number {
  const s = game.current;
  // Photo mode: the first tile flip is free; costs start with the second.
  if (game.mode === 'photo') return Math.max(s.purchased.length - 1, 0) * TILE_PRICE;
  return s.purchased.reduce((sum, i) => sum + (s.clues[i]?.price ?? 0), 0);
}

function potentialScore(game: Game): number {
  let score = BASE - spent(game);
  if (game.scoring === 'decay') score -= WRONG_COST * game.current.wrongGuesses;
  return Math.max(score, FLOOR);
}

async function resolve(game: Game, solved: boolean): Promise<void> {
  const s = game.current;
  s.status = solved ? 'solved' : 'failed';
  const scoreEarned = solved ? potentialScore(game) : 0;
  game.totalScore += scoreEarned;
  const f = s.flight;
  // The pick-time snapshot can be minutes stale by resolution; show where the
  // aircraft actually is right now, falling back to the snapshot if it's gone.
  const [photo, liveSnapshot] = await Promise.all([
    fetchPhoto(f.registration),
    fetchLiveSnapshot(f.hex),
  ]);
  const snapshot = liveSnapshot ?? f.snapshot;
  const progressPct = liveSnapshot
    ? Math.round(Math.min(Math.max(haversineKm(f.origin, snapshot) / f.routeKm, 0), 1) * 100)
    : f.progressPct;
  s.reveal = {
    callsign: f.callsign,
    registration: f.registration,
    typeIcao: f.type.icao,
    typeName: f.type.name,
    airlineIcao: f.airline.icao,
    airlineName: f.airline.name,
    origin: f.origin,
    destination: f.destination,
    snapshot,
    routeKm: Math.round(f.routeKm),
    progressPct,
    photo,
    scoreEarned,
    solved,
  };
  game.past.push(s.reveal);
}

/** A fully-revealed random live flight for the home-screen spotlight. */
export async function spotlightFlight(): Promise<Reveal> {
  const f = await pickFlight(new Set());
  return {
    callsign: f.callsign,
    registration: f.registration,
    typeIcao: f.type.icao,
    typeName: f.type.name,
    airlineIcao: f.airline.icao,
    airlineName: f.airline.name,
    origin: f.origin,
    destination: f.destination,
    snapshot: f.snapshot,
    routeKm: Math.round(f.routeKm),
    progressPct: f.progressPct,
    photo: await fetchPhoto(f.registration),
    scoreEarned: 0,
    solved: true,
  };
}

export async function createGame(
  mode: Mode,
  scoring: Scoring,
  flightCount: number,
  provider?: SeedProvider,
): Promise<Game> {
  const usedHexes = new Set<string>();
  const seed = provider ? await provider(0) : await makeSeed(mode, usedHexes);
  const game: Game = {
    id: randomUUID(),
    mode,
    scoring,
    flightCount,
    flightIndex: 1,
    totalScore: 0,
    usedHexes,
    provider,
    current: sessionFromSeed(seed),
    past: [],
    lastTouched: Date.now(),
  };
  games.set(game.id, game);
  return game;
}

export function getGame(id: string): Game {
  const game = games.get(id);
  if (!game) throw new HttpError(404, 'Game not found.');
  game.lastTouched = Date.now();
  return game;
}

/** Buy one clue (or, in photo mode, one tile) by index. */
export function purchaseClue(game: Game, index: number): void {
  const s = game.current;
  if (s.status !== 'playing') throw new HttpError(409, 'This flight is already resolved.');
  if (!Number.isInteger(index)) throw new HttpError(400, 'Missing clue index.');
  let price: number;
  if (game.mode === 'photo') {
    const tiles = (s.board?.cols ?? 0) * (s.board?.rows ?? 0);
    if (index < 0 || index >= tiles) throw new HttpError(400, 'No such tile.');
    price = s.purchased.length === 0 ? 0 : TILE_PRICE;
  } else {
    const clue = s.clues[index];
    if (!clue) throw new HttpError(400, 'No such clue.');
    price = clue.price;
  }
  if (s.purchased.includes(index)) throw new HttpError(409, 'Already revealed.');
  if (potentialScore(game) - price < FLOOR) {
    throw new HttpError(400, 'Not enough points left to buy this.', 'CANT_AFFORD');
  }
  s.purchased.push(index);
}

function requireAirport(icao: string | undefined, field: string) {
  if (!icao) throw new HttpError(400, `Missing ${field} in guess.`);
  const airport = airportsByIcao.get(icao.toUpperCase().trim());
  if (!airport) throw new HttpError(400, `Unknown airport: ${icao}`);
  return airport;
}

function checkAirport(raw: string | undefined, field: string, truth: FlightRecord['origin']) {
  const guessed = requireAirport(raw, field);
  const correct = guessed.icao === truth.icao;
  return {
    guessed: guessed.icao,
    guessedLabel: airportLabel(guessed),
    correct,
    ...(correct
      ? {}
      : {
          distanceKm: Math.round(haversineKm(guessed, truth)),
          bearing: bearingIndex(guessed, truth),
        }),
  };
}

function checkAirline(raw: string, f: FlightRecord) {
  const guessed = airlinesByIcao.get(raw.toUpperCase().trim());
  if (!guessed) throw new HttpError(400, `Unknown airline: ${raw}`);
  // Brand merging: the operator and its mainline brand(s) all count.
  const correct = f.acceptedAirlines.includes(guessed.icao);
  return {
    guessed: guessed.icao,
    guessedLabel: guessed.name,
    correct,
    ...(correct
      ? {}
      : {
          countryMatch: Boolean(f.airline.country) && guessed.country === f.airline.country,
          allianceMatch: Boolean(f.airline.alliance) && guessed.alliance === f.airline.alliance,
        }),
  };
}

function checkType(raw: string, f: FlightRecord) {
  const guessed = typesByIcao.get(raw.toUpperCase().trim());
  if (!guessed) throw new HttpError(400, `Unknown aircraft type: ${raw}`);
  const correct = guessed.icao === f.type.icao || guessed.name === f.type.name;
  return {
    guessed: guessed.icao,
    guessedLabel: guessed.name,
    correct,
    familyMatch: !correct && guessed.family === f.type.family,
    manufacturerMatch: !correct && guessed.manufacturer === f.type.manufacturer,
  };
}

export async function applyGuess(game: Game, guess: Guess): Promise<void> {
  const s = game.current;
  if (s.status !== 'playing') throw new HttpError(409, 'This flight is already resolved.');
  const f = s.flight;
  let solved = false;
  const feedback: Feedback = { kind: game.mode, correct: false, atClue: s.purchased.length };

  if (game.mode === 'route' || game.mode === 'departure' || game.mode === 'arrival') {
    const wantOrigin = game.mode !== 'arrival';
    const wantDest = game.mode !== 'departure';

    let originCorrect = !wantOrigin || Boolean(s.locked.origin);
    if (wantOrigin && !s.locked.origin) {
      feedback.origin = checkAirport(guess.origin, 'origin', f.origin);
      originCorrect = feedback.origin.correct;
      if (originCorrect) s.locked.origin = true;
    }

    let destCorrect = !wantDest || Boolean(s.locked.destination);
    if (wantDest && !s.locked.destination) {
      feedback.destination = checkAirport(guess.destination, 'destination', f.destination);
      destCorrect = feedback.destination.correct;
      if (destCorrect) s.locked.destination = true;
    }

    solved = originCorrect && destCorrect;
  } else if (game.mode === 'fill') {
    // All four facts are independent lockable targets; guesses may cover any
    // subset of the still-hidden ones.
    if (!s.locked.origin && guess.origin) {
      feedback.origin = checkAirport(guess.origin, 'origin', f.origin);
      if (feedback.origin.correct) s.locked.origin = true;
    }
    if (!s.locked.destination && guess.destination) {
      feedback.destination = checkAirport(guess.destination, 'destination', f.destination);
      if (feedback.destination.correct) s.locked.destination = true;
    }
    if (!s.locked.airline && guess.airline) {
      feedback.airline = checkAirline(guess.airline, f);
      if (feedback.airline.correct) s.locked.airline = true;
    }
    if (!s.locked.type && guess.type) {
      feedback.type = checkType(guess.type, f);
      if (feedback.type.correct) s.locked.type = true;
    }
    if (!feedback.origin && !feedback.destination && !feedback.airline && !feedback.type) {
      throw new HttpError(400, 'Submit a guess for at least one hidden field.');
    }
    solved = Boolean(
      s.locked.origin && s.locked.destination && s.locked.airline && s.locked.type,
    );
  } else if (game.mode === 'airline') {
    if (!guess.airline) throw new HttpError(400, 'Missing airline in guess.');
    feedback.airline = checkAirline(guess.airline, f);
    solved = feedback.airline.correct;
  } else if (game.mode === 'type') {
    if (!guess.type) throw new HttpError(400, 'Missing aircraft type in guess.');
    feedback.type = checkType(guess.type, f);
    solved = feedback.type.correct;
  } else {
    // Photo mode: airline and type are guessed independently; each locks when
    // correct, and the flight is solved once both are locked.
    if (!s.locked.airline && guess.airline !== undefined && guess.airline !== '') {
      feedback.airline = checkAirline(guess.airline, f);
      if (feedback.airline.correct) s.locked.airline = true;
    }
    if (!s.locked.type && guess.type !== undefined && guess.type !== '') {
      feedback.type = checkType(guess.type, f);
      if (feedback.type.correct) s.locked.type = true;
    }
    if (!feedback.airline && !feedback.type) {
      throw new HttpError(400, 'Submit an airline or an aircraft type.');
    }
    solved = Boolean(s.locked.airline && s.locked.type);
  }

  feedback.correct = solved;
  s.feedback.push(feedback);

  if (solved) {
    await resolve(game, true);
    return;
  }
  const anyWrong = [feedback.origin, feedback.destination, feedback.airline, feedback.type].some(
    (r) => r !== undefined && !r.correct,
  );
  if (anyWrong) {
    s.wrongGuesses++;
    if (game.scoring === 'strikes' && s.wrongGuesses >= strikesFor(game.mode)) {
      await resolve(game, false);
    }
  }
}

export async function giveUp(game: Game): Promise<void> {
  if (game.current.status !== 'playing') throw new HttpError(409, 'This flight is already resolved.');
  await resolve(game, false);
}

export async function nextFlight(game: Game): Promise<void> {
  if (game.current.status === 'playing') throw new HttpError(409, 'Finish the current flight first.');
  if (game.flightIndex >= game.flightCount) throw new HttpError(400, 'The match is over.');
  const seed = game.provider
    ? await game.provider(game.flightIndex)
    : await makeSeed(game.mode, game.usedHexes);
  game.current = sessionFromSeed(seed);
  game.flightIndex++;
}

/** Returns the JPEG crop for one revealed tile of a photo-mode game. */
export async function getTile(game: Game, index: number): Promise<Buffer> {
  const s = game.current;
  const b = s.board;
  if (!b) throw new HttpError(404, 'Not a photo game.');
  if (!s.purchased.includes(index)) throw new HttpError(403, 'Tile not revealed.');
  const cached = b.tileCache.get(index);
  if (cached) return cached;
  const col = index % b.cols;
  const row = Math.floor(index / b.cols);
  const w = Math.floor(b.width / b.cols);
  const h = Math.floor(b.height / b.rows);
  const left = col * w;
  const top = row * h;
  const buf = await sharp(b.image)
    .extract({
      left,
      top,
      width: col === b.cols - 1 ? b.width - left : w,
      height: row === b.rows - 1 ? b.height - top : h,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  b.tileCache.set(index, buf);
  return buf;
}

export function toDTO(game: Game): GameDTO {
  const s = game.current;
  const f = s.flight;
  const offers: ClueOffer[] = s.clues.map((c) => {
    const purchased = s.purchased.includes(c.index);
    return {
      index: c.index,
      key: c.key,
      price: c.price,
      purchased,
      ...(c.tag !== undefined ? { tag: c.tag } : {}),
      ...(purchased ? { params: c.params, ...(c.map ? { map: c.map } : {}) } : {}),
    };
  });
  const current: FlightStateDTO = {
    status: s.status,
    clues: offers,
    purchasedOrder: [...s.purchased],
    wrongGuesses: s.wrongGuesses,
    strikesLeft:
      game.scoring === 'strikes' ? Math.max(strikesFor(game.mode) - s.wrongGuesses, 0) : null,
    strikesTotal: game.scoring === 'strikes' ? strikesFor(game.mode) : null,
    potentialScore: potentialScore(game),
    locked: {
      ...(s.locked.origin ? { origin: { icao: f.origin.icao, label: airportLabel(f.origin) } } : {}),
      ...(s.locked.destination
        ? { destination: { icao: f.destination.icao, label: airportLabel(f.destination) } }
        : {}),
      ...(s.locked.airline ? { airline: { icao: f.airline.icao, label: f.airline.name } } : {}),
      ...(s.locked.type ? { type: { icao: f.type.icao, label: f.type.name } } : {}),
    },
    feedback: s.feedback,
    reveal: s.reveal,
    photoBoard: s.board
      ? {
          cols: s.board.cols,
          rows: s.board.rows,
          width: s.board.width,
          height: s.board.height,
          tilePrice: TILE_PRICE,
          revealed: [...s.purchased],
        }
      : null,
  };
  return {
    gameId: game.id,
    mode: game.mode,
    scoring: game.scoring,
    flightCount: game.flightCount,
    flightIndex: game.flightIndex,
    totalScore: game.totalScore,
    ...(game.dailyDay ? { daily: { day: game.dailyDay } } : {}),
    current,
    past: game.past,
    matchOver: game.flightIndex >= game.flightCount && s.status !== 'playing',
  };
}
