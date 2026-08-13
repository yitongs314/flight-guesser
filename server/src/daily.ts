import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, makeSeed, type Game, type SessionSeed } from './game';
import type { Mode } from './types';

/**
 * The daily flight: one shared seed per UTC day — every player faces the same
 * flight, clue shop, and (in photo mode) the same board. State persists to
 * disk so dev restarts and redeploys don't reroll the day.
 */

// Overridable so deployments can point at a persistent volume.
const STATE_FILE =
  process.env.DAILY_STATE_PATH ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'daily.json');

// Day #1 = the game's launch day.
const DAY_ZERO = Math.floor(Date.UTC(2026, 7, 13) / 86_400_000) - 1;
const MODE_ROTATION: Mode[] = ['route', 'airline', 'type', 'photo', 'fill'];
const MAX_RECORDS = 500;

export interface DailyRecord {
  name: string;
  score: number;
  solved: boolean;
  at: number;
}

interface DailyState {
  day: number;
  mode: Mode;
  seed: SessionSeed;
  records: DailyRecord[];
}

interface SerializedState {
  day: number;
  mode: Mode;
  seed: Omit<SessionSeed, 'board'> & {
    board: { imageB64: string; width: number; height: number; cols: number; rows: number } | null;
  };
  records: DailyRecord[];
}

function todayNumber(): number {
  return Math.floor(Date.now() / 86_400_000) - DAY_ZERO;
}

function serialize(state: DailyState): string {
  const { board, ...seedRest } = state.seed;
  return JSON.stringify({
    day: state.day,
    mode: state.mode,
    seed: {
      ...seedRest,
      board: board
        ? {
            imageB64: board.image.toString('base64'),
            width: board.width,
            height: board.height,
            cols: board.cols,
            rows: board.rows,
          }
        : null,
    },
    records: state.records,
  } satisfies SerializedState);
}

function revive(json: string): DailyState {
  const raw = JSON.parse(json) as SerializedState;
  const { board, ...seedRest } = raw.seed;
  return {
    day: raw.day,
    mode: raw.mode,
    records: raw.records,
    seed: {
      ...seedRest,
      board: board
        ? {
            image: Buffer.from(board.imageB64, 'base64'),
            width: board.width,
            height: board.height,
            cols: board.cols,
            rows: board.rows,
            tileCache: new Map(),
          }
        : null,
    },
  };
}

let state: DailyState | null = null;
try {
  state = revive(readFileSync(STATE_FILE, 'utf8'));
} catch {
  state = null;
}

function save(): void {
  if (!state) return;
  try {
    writeFileSync(STATE_FILE, serialize(state));
  } catch {
    // persistence is best-effort; the day keeps working from memory
  }
}

let creating: Promise<DailyState> | null = null;

export function ensureToday(): Promise<DailyState> {
  const today = todayNumber();
  if (state && state.day === today) return Promise.resolve(state);
  if (!creating) {
    creating = (async () => {
      let mode = MODE_ROTATION[today % MODE_ROTATION.length];
      let seed: SessionSeed;
      try {
        seed = await makeSeed(mode, new Set());
      } catch (e) {
        // Photo mode can fail (no contact configured / no photo found) —
        // fall back so the daily always exists.
        if (mode === 'photo') {
          mode = 'route';
          seed = await makeSeed(mode, new Set());
        } else {
          throw e;
        }
      }
      state = { day: today, mode, seed, records: [] };
      save();
      return state;
    })().finally(() => {
      creating = null;
    });
  }
  return creating;
}

export async function createDailyGame(rawName: string): Promise<Game> {
  const st = await ensureToday();
  const name = rawName.trim().slice(0, 20) || 'Anonymous';
  const game = await createGame(st.mode, 'decay', 1, async () => st.seed);
  game.dailyDay = st.day;
  game.dailyName = name;
  return game;
}

/** Called after game actions: records a finished daily attempt exactly once. */
export function dailyOnAction(game: Game): void {
  if (!game.dailyDay || game.dailyRecorded) return;
  if (game.current.status === 'playing') return;
  if (!state || state.day !== game.dailyDay) return;
  game.dailyRecorded = true;
  const score = game.totalScore;
  const solved = game.current.status === 'solved';
  const existing = state.records.find((r) => r.name === game.dailyName);
  if (existing) {
    // Honor-system single attempt; keep the best if someone replays.
    if (score > existing.score) {
      existing.score = score;
      existing.solved = solved;
      existing.at = Date.now();
    }
  } else if (state.records.length < MAX_RECORDS) {
    state.records.push({ name: game.dailyName ?? 'Anonymous', score, solved, at: Date.now() });
  }
  save();
}

export async function dailyInfo(): Promise<{ day: number; mode: Mode; players: number }> {
  const st = await ensureToday();
  return { day: st.day, mode: st.mode, players: st.records.length };
}

export async function dailyLeaderboard(): Promise<{
  day: number;
  mode: Mode;
  entries: DailyRecord[];
}> {
  const st = await ensureToday();
  const entries = [...st.records].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 20);
  return { day: st.day, mode: st.mode, entries };
}
