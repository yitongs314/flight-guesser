import type {
  DailyEntry,
  DailyInfo,
  Datasets,
  GameDTO,
  GuessPayload,
  Mode,
  Reveal,
  RoomDTO,
  Scoring,
} from './types';

export interface ApiError extends Error {
  code?: string;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    code?: string;
  };
  if (!res.ok) {
    const err: ApiError = new Error(body.error ?? body.message ?? `HTTP ${res.status}`);
    err.code = body.code;
    throw err;
  }
  return body as T;
}

export const api = {
  datasets: () => req<Datasets>('/api/datasets'),
  spotlight: () => req<Reveal>('/api/spotlight'),
  daily: () => req<DailyInfo>('/api/daily'),
  dailyStart: (name: string) =>
    req<GameDTO>('/api/daily/game', { method: 'POST', body: JSON.stringify({ name }) }),
  dailyBoard: () =>
    req<{ day: number; mode: Mode; entries: DailyEntry[] }>('/api/daily/leaderboard'),
  create: (mode: Mode, scoring: Scoring, flightCount: number) =>
    req<GameDTO>('/api/games', {
      method: 'POST',
      body: JSON.stringify({ mode, scoring, flightCount }),
    }),
  clue: (id: string, index: number) =>
    req<GameDTO>(`/api/games/${id}/clue`, { method: 'POST', body: JSON.stringify({ index }) }),
  guess: (id: string, guess: GuessPayload) =>
    req<GameDTO>(`/api/games/${id}/guess`, { method: 'POST', body: JSON.stringify(guess) }),
  giveUp: (id: string) => req<GameDTO>(`/api/games/${id}/give-up`, { method: 'POST', body: '{}' }),
  next: (id: string) => req<GameDTO>(`/api/games/${id}/next`, { method: 'POST', body: '{}' }),
  createRoom: (mode: Mode, scoring: Scoring, flightCount: number) =>
    req<{ code: string; token: string }>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ mode, scoring, flightCount }),
    }),
  joinRoom: (code: string) =>
    req<{ code: string; token: string }>(`/api/rooms/${encodeURIComponent(code)}/join`, {
      method: 'POST',
      body: '{}',
    }),
  roomState: (code: string, token: string) =>
    req<RoomDTO>(`/api/rooms/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`),
  roomReady: (code: string, token: string) =>
    req<RoomDTO>(`/api/rooms/${encodeURIComponent(code)}/ready`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};
