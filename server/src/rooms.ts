import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  createGame,
  giveUp,
  makeSeed,
  nextFlight,
  toDTO,
  type Game,
  type SessionSeed,
} from './game';
import type { Mode, OpponentDTO, RoomDTO, Scoring } from './types';
import { HttpError } from './util';

interface RoomPlayer {
  token: string;
  game: Game | null;
  ready: boolean;
  sockets: Set<WebSocket>;
}

interface Room {
  code: string;
  mode: Mode;
  scoring: Scoring;
  flightCount: number;
  usedHexes: Set<string>;
  /** Memoized per flight index so both players draw the identical seed. */
  seeds: Map<number, Promise<SessionSeed>>;
  players: RoomPlayer[];
  lastTouched: number;
}

const rooms = new Map<string, Room>();
const roomByGameId = new Map<string, Room>();

setInterval(() => {
  const cutoff = Date.now() - 12 * 3600 * 1000;
  for (const [code, room] of rooms) {
    if (room.lastTouched < cutoff) {
      for (const p of room.players) {
        if (p.game) roomByGameId.delete(p.game.id);
      }
      rooms.delete(code);
    }
  }
}, 30 * 60 * 1000).unref();

// No 0/O/1/I to keep codes easy to read out loud.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
}

function getSeed(room: Room, index: number): Promise<SessionSeed> {
  let seed = room.seeds.get(index);
  if (!seed) {
    seed = makeSeed(room.mode, room.usedHexes);
    room.seeds.set(index, seed);
  }
  return seed;
}

export function getRoom(code: string): Room {
  const room = rooms.get(code.toUpperCase().trim());
  if (!room) throw new HttpError(404, 'Room not found or expired.', 'ROOM_NOT_FOUND');
  room.lastTouched = Date.now();
  return room;
}

function playerByToken(room: Room, token: string | undefined): RoomPlayer {
  const player = room.players.find((p) => p.token === token);
  if (!player) throw new HttpError(401, 'Not a member of this room.');
  return player;
}

export function createRoom(
  mode: Mode,
  scoring: Scoring,
  flightCount: number,
): { code: string; token: string } {
  const room: Room = {
    code: newCode(),
    mode,
    scoring,
    flightCount,
    usedHexes: new Set(),
    seeds: new Map(),
    players: [{ token: randomUUID(), game: null, ready: false, sockets: new Set() }],
    lastTouched: Date.now(),
  };
  rooms.set(room.code, room);
  return { code: room.code, token: room.players[0].token };
}

export async function joinRoom(code: string): Promise<{ code: string; token: string }> {
  const room = getRoom(code);
  if (room.players.length >= 2) throw new HttpError(409, 'Room is already full.', 'ROOM_FULL');
  const player: RoomPlayer = { token: randomUUID(), game: null, ready: false, sockets: new Set() };
  room.players.push(player);
  // Second player arrived: create both games off the shared seed source.
  const provider = (i: number) => getSeed(room, i);
  for (const p of room.players) {
    p.game = await createGame(room.mode, room.scoring, room.flightCount, provider);
    roomByGameId.set(p.game.id, room);
  }
  broadcast(room);
  return { code: room.code, token: player.token };
}

function roomStatus(room: Room): RoomDTO['status'] {
  if (room.players.length < 2 || room.players.some((p) => !p.game)) return 'waiting';
  const over = room.players.every((p) => toDTO(p.game!).matchOver);
  return over ? 'over' : 'playing';
}

export function roomDTO(room: Room, token: string): RoomDTO {
  const me = playerByToken(room, token);
  const opp = room.players.find((p) => p !== me);
  let opponent: OpponentDTO | null = null;
  if (opp?.game) {
    const dto = toDTO(opp.game);
    opponent = {
      totalScore: dto.totalScore,
      flightIndex: dto.flightIndex,
      ready: opp.ready,
      status: dto.current.status,
      potentialScore: dto.current.potentialScore,
      purchasedCount: dto.current.purchasedOrder.length,
      wrongGuesses: dto.current.wrongGuesses,
      scoreEarned: dto.current.reveal ? dto.current.reveal.scoreEarned : null,
    };
  }
  return {
    code: room.code,
    status: roomStatus(room),
    mode: room.mode,
    scoring: room.scoring,
    flightCount: room.flightCount,
    youReady: me.ready,
    you: me.game ? toDTO(me.game) : null,
    opponent,
  };
}

function broadcast(room: Room): void {
  for (const player of room.players) {
    if (player.sockets.size === 0) continue;
    const payload = JSON.stringify(roomDTO(room, player.token));
    for (const ws of player.sockets) {
      try {
        ws.send(payload);
      } catch {
        // dead socket; close handler will clean it up
      }
    }
  }
}

/** Called after any game action so rooms can race-resolve and push updates. */
export async function onGameAction(gameId: string): Promise<void> {
  const room = roomByGameId.get(gameId);
  if (!room) return;
  room.lastTouched = Date.now();
  if (room.scoring === 'race') {
    const solved = room.players.find((p) => p.game?.current.status === 'solved');
    const other = room.players.find((p) => p !== solved);
    if (solved && other?.game?.current.status === 'playing') {
      await giveUp(other.game);
    }
  }
  broadcast(room);
}

export async function setReady(code: string, token: string): Promise<RoomDTO> {
  const room = getRoom(code);
  const me = playerByToken(room, token);
  if (!me.game || me.game.current.status === 'playing') {
    throw new HttpError(409, 'Finish the current flight first.');
  }
  me.ready = true;
  const [a, b] = room.players;
  if (
    a.game &&
    b?.game &&
    a.ready &&
    b.ready &&
    a.game.current.status !== 'playing' &&
    b.game.current.status !== 'playing' &&
    !toDTO(a.game).matchOver
  ) {
    // Sequential on purpose: the first call resolves the shared seed pick,
    // the second reuses it.
    await nextFlight(a.game);
    await nextFlight(b.game);
    a.ready = false;
    b.ready = false;
  }
  broadcast(room);
  return roomDTO(room, token);
}

export function attachSocket(code: string, token: string, ws: WebSocket): void {
  const room = getRoom(code);
  const player = playerByToken(room, token);
  player.sockets.add(ws);
  ws.on('close', () => player.sockets.delete(ws));
  try {
    ws.send(JSON.stringify(roomDTO(room, player.token)));
  } catch {
    player.sockets.delete(ws);
  }
}
