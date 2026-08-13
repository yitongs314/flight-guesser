import './env';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import type { WebSocket } from 'ws';
import { createDailyGame, dailyInfo, dailyLeaderboard, dailyOnAction } from './daily';
import {
  attachSocket,
  createRoom,
  getRoom,
  joinRoom,
  onGameAction,
  roomDTO,
  setReady,
} from './rooms';
import { aircraftTypes, airlines, airports } from './data';
import { PickError } from './flightPicker';
import {
  applyGuess,
  createGame,
  getGame,
  getTile,
  giveUp,
  nextFlight,
  purchaseClue,
  spotlightFlight,
  toDTO,
} from './game';
import type { Guess, Mode, Scoring } from './types';
import { HttpError } from './util';

const MODES: Mode[] = ['route', 'departure', 'arrival', 'airline', 'type', 'photo', 'fill'];
// 'race' is two-player only; single-player games reject it.
const SCORINGS: Scoring[] = ['decay', 'strikes'];
const ROOM_SCORINGS: Scoring[] = ['decay', 'strikes', 'race'];

const app = Fastify({ logger: { level: 'warn' } });
app.register(websocket);

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof HttpError) {
    return reply
      .status(err.statusCode)
      .send({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  }
  if (err instanceof PickError) {
    return reply.status(503).send({ error: err.message, code: 'NO_FLIGHT' });
  }
  app.log.error(err);
  return reply.status(500).send({ error: 'Internal server error.' });
});

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/datasets', async () => ({
  airports: airports.map(({ icao, iata, name, city, country, countryCode }) => ({
    icao,
    iata,
    name,
    city,
    country,
    countryCode,
  })),
  airlines: airlines.map(({ icao, iata, name, country, countryCode }) => ({
    icao,
    iata,
    name,
    country,
    countryCode,
  })),
  aircraftTypes,
}));

app.get('/api/spotlight', async () => spotlightFlight());

app.post('/api/games', async (req) => {
  const body = (req.body ?? {}) as { mode?: string; scoring?: string; flightCount?: number };
  const mode = body.mode as Mode;
  const scoring = (body.scoring ?? 'decay') as Scoring;
  if (!MODES.includes(mode)) throw new HttpError(400, `mode must be one of: ${MODES.join(', ')}`);
  if (!SCORINGS.includes(scoring))
    throw new HttpError(400, `scoring must be one of: ${SCORINGS.join(', ')}`);
  const flightCount = Math.min(Math.max(Math.trunc(body.flightCount ?? 5), 1), 10);
  const game = await createGame(mode, scoring, flightCount);
  return toDTO(game);
});

app.get('/api/games/:id', async (req) => {
  const { id } = req.params as { id: string };
  return toDTO(getGame(id));
});

app.post('/api/games/:id/clue', async (req) => {
  const { id } = req.params as { id: string };
  const body = (req.body ?? {}) as { index?: number };
  const game = getGame(id);
  purchaseClue(game, Number(body.index));
  await onGameAction(id);
  return toDTO(game);
});

app.post('/api/games/:id/guess', async (req) => {
  const { id } = req.params as { id: string };
  const game = getGame(id);
  await applyGuess(game, (req.body ?? {}) as Guess);
  await onGameAction(id);
  dailyOnAction(game);
  return toDTO(game);
});

app.post('/api/games/:id/give-up', async (req) => {
  const { id } = req.params as { id: string };
  const game = getGame(id);
  await giveUp(game);
  await onGameAction(id);
  dailyOnAction(game);
  return toDTO(game);
});

app.get('/api/games/:id/tiles/:index', async (req, reply) => {
  const { id, index } = req.params as { id: string; index: string };
  const game = getGame(id);
  const tile = await getTile(game, Number(index));
  return reply
    .header('content-type', 'image/jpeg')
    .header('cache-control', 'private, max-age=86400')
    .send(tile);
});

app.post('/api/games/:id/next', async (req) => {
  const { id } = req.params as { id: string };
  const game = getGame(id);
  await nextFlight(game);
  return toDTO(game);
});

app.get('/api/daily', async () => dailyInfo());

app.post('/api/daily/game', async (req) => {
  const body = (req.body ?? {}) as { name?: string };
  const game = await createDailyGame(body.name ?? '');
  return toDTO(game);
});

app.get('/api/daily/leaderboard', async () => dailyLeaderboard());

app.post('/api/rooms', async (req) => {
  const body = (req.body ?? {}) as { mode?: string; scoring?: string; flightCount?: number };
  const mode = body.mode as Mode;
  const scoring = (body.scoring ?? 'decay') as Scoring;
  if (!MODES.includes(mode)) throw new HttpError(400, `mode must be one of: ${MODES.join(', ')}`);
  if (!ROOM_SCORINGS.includes(scoring))
    throw new HttpError(400, `scoring must be one of: ${ROOM_SCORINGS.join(', ')}`);
  const flightCount = Math.min(Math.max(Math.trunc(body.flightCount ?? 5), 1), 10);
  return createRoom(mode, scoring, flightCount);
});

app.post('/api/rooms/:code/join', async (req) => {
  const { code } = req.params as { code: string };
  return joinRoom(code);
});

app.get('/api/rooms/:code', async (req) => {
  const { code } = req.params as { code: string };
  const { token } = req.query as { token?: string };
  return roomDTO(getRoom(code), token ?? '');
});

app.post('/api/rooms/:code/ready', async (req) => {
  const { code } = req.params as { code: string };
  const body = (req.body ?? {}) as { token?: string };
  return setReady(code, body.token ?? '');
});

app.register(async (instance) => {
  instance.get('/api/rooms/:code/ws', { websocket: true }, (conn, req) => {
    // @fastify/websocket v11 passes the WebSocket directly; older versions
    // pass a stream wrapper with .socket.
    const ws = ((conn as { socket?: WebSocket }).socket ?? conn) as WebSocket;
    const { code } = req.params as { code: string };
    const { token } = req.query as { token?: string };
    try {
      attachSocket(code, token ?? '', ws);
    } catch {
      ws.close(4004, 'invalid room or token');
    }
  });
});

const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  // Production serves the built frontend from the same process.
  const webDist = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'web',
    'dist',
  );
  app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((req, reply) => {
    if (req.method !== 'GET' || req.raw.url?.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not found.' });
    }
    // SPA fallback
    return reply.sendFile('index.html');
  });
}

// Dev deliberately ignores PORT (tooling injects it); production respects it.
const port = Number(process.env.API_PORT ?? (isProd ? (process.env.PORT ?? 8080) : 8787));
const host = isProd ? '0.0.0.0' : '127.0.0.1';
app
  .listen({ port, host })
  .then(() => console.log(`Flight Guesser listening on http://${host}:${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
