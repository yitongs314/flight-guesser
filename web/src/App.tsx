import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ApiError } from './api';
import GameScreen from './components/GameScreen';
import HomeScreen from './components/HomeScreen';
import MatchSummary from './components/MatchSummary';
import { useI18n } from './i18n';
import { recordFlight } from './stats';
import type {
  DailyEntry,
  DailyInfo,
  Datasets,
  GameDTO,
  GuessPayload,
  Mode,
  RoomDTO,
  Scoring,
} from './types';

type Screen = 'home' | 'lobby' | 'game' | 'summary';

interface Failure {
  message: string;
  code?: string;
}

interface RoomKey {
  code: string;
  token: string;
}

const ROOM_STORAGE = 'fg-room';

export default function App() {
  const { lang, setLang, t } = useI18n();
  const [datasets, setDatasets] = useState<Datasets | null>(null);
  const [game, setGame] = useState<GameDTO | null>(null);
  const [room, setRoom] = useState<RoomKey | null>(null);
  const [roomDto, setRoomDto] = useState<RoomDTO | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const [dailyMeta, setDailyMeta] = useState<DailyInfo | null>(null);
  const [dailyDone, setDailyDone] = useState<{ score: number; solved: boolean } | null>(null);
  const [board, setBoard] = useState<{ day: number; entries: DailyEntry[] } | null>(null);
  const roomRef = useRef<RoomKey | null>(null);
  roomRef.current = room;

  useEffect(() => {
    api
      .daily()
      .then((info) => {
        setDailyMeta(info);
        try {
          const done = localStorage.getItem(`fg-daily-${info.day}`);
          if (done) setDailyDone(JSON.parse(done));
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, []);

  // Personal stats: count each resolved flight once.
  const countedFlights = useRef(new Set<string>());
  useEffect(() => {
    const reveal = game?.current.reveal;
    if (!game || !reveal) return;
    const key = `${game.gameId}:${game.flightIndex}`;
    if (countedFlights.current.has(key)) return;
    countedFlights.current.add(key);
    recordFlight(game.mode, reveal.solved, reveal.scoreEarned);
    if (game.daily) {
      const done = { score: game.totalScore, solved: reveal.solved };
      localStorage.setItem(`fg-daily-${game.daily.day}`, JSON.stringify(done));
      setDailyDone(done);
      setDailyMeta((m) => (m ? { ...m, players: m.players + 1 } : m));
    }
  }, [game]);

  useEffect(() => {
    api
      .datasets()
      .then(setDatasets)
      .catch(() => setError({ message: '', code: 'datasets' }));
  }, []);

  // Menu, lobby, and game fit one viewport; suppress the page scrollbar there
  // (inner panels scroll instead).
  useEffect(() => {
    const lock = screen === 'home' || screen === 'lobby' || screen === 'game';
    document.body.classList.toggle('no-scroll', lock);
    return () => document.body.classList.remove('no-scroll');
  }, [screen]);

  const applyRoomDto = useCallback((dto: RoomDTO) => {
    setRoomDto(dto);
    if (dto.you) setGame(dto.you);
    // 'over' does not force the summary: the player should see the last
    // flight's reveal card first and click through to the result.
    setScreen((prev) =>
      dto.status === 'waiting' ? 'lobby' : prev === 'summary' && dto.status === 'over' ? 'summary' : 'game',
    );
  }, []);

  // Resume a room after a refresh.
  useEffect(() => {
    const stored = localStorage.getItem(ROOM_STORAGE);
    if (!stored) return;
    try {
      const key = JSON.parse(stored) as RoomKey;
      api
        .roomState(key.code, key.token)
        .then((dto) => {
          setRoom(key);
          applyRoomDto(dto);
        })
        .catch(() => localStorage.removeItem(ROOM_STORAGE));
    } catch {
      localStorage.removeItem(ROOM_STORAGE);
    }
  }, [applyRoomDto]);

  // Live updates over WebSocket while in a room.
  useEffect(() => {
    if (!room) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: number | undefined;
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(
        `${proto}://${location.host}/api/rooms/${room.code}/ws?token=${encodeURIComponent(room.token)}`,
      );
      ws.onmessage = (ev) => {
        try {
          applyRoomDto(JSON.parse(ev.data as string) as RoomDTO);
        } catch {
          // malformed frame; ignore
        }
      };
      ws.onclose = () => {
        if (!closed) retry = window.setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(retry);
      ws?.close();
    };
  }, [room, applyRoomDto]);

  const fail = (e: unknown) => {
    const err = e as ApiError;
    setError({ message: err.message, code: err.code });
  };

  const run = useCallback(async (message: string | null, fn: () => Promise<GameDTO>) => {
    setError(null);
    if (message) setBusy(message);
    try {
      const next = await fn();
      setGame(next);
      return next;
    } catch (e) {
      fail(e);
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  const start = async (mode: Mode, scoring: Scoring, flightCount: number) => {
    const created = await run(t('busy.find'), () => api.create(mode, scoring, flightCount));
    if (created) setScreen('game');
  };

  const startDaily = async (name: string) => {
    localStorage.setItem('fg-name', name);
    const created = await run(t('busy.find'), () => api.dailyStart(name));
    if (created) setScreen('game');
  };

  const openBoard = () => {
    api
      .dailyBoard()
      .then((b) => setBoard({ day: b.day, entries: b.entries }))
      .catch(fail);
  };

  const createRoom = async (mode: Mode, scoring: Scoring, flightCount: number) => {
    setError(null);
    try {
      const key = await api.createRoom(mode, scoring, flightCount);
      localStorage.setItem(ROOM_STORAGE, JSON.stringify(key));
      setRoom(key);
      setScreen('lobby');
    } catch (e) {
      fail(e);
    }
  };

  const joinRoom = async (code: string) => {
    setError(null);
    setBusy(t('busy.find'));
    try {
      const key = await api.joinRoom(code);
      localStorage.setItem(ROOM_STORAGE, JSON.stringify(key));
      const dto = await api.roomState(key.code, key.token);
      setRoom(key);
      applyRoomDto(dto);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const leaveRoom = () => {
    localStorage.removeItem(ROOM_STORAGE);
    setRoom(null);
    setRoomDto(null);
    setGame(null);
    setScreen('home');
  };

  const onGuess = (guess: GuessPayload) => {
    if (game) void run(null, () => api.guess(game.gameId, guess));
  };
  const onClue = (index: number) => {
    if (game) void run(null, () => api.clue(game.gameId, index));
  };
  const onGiveUp = () => {
    if (game) void run(null, () => api.giveUp(game.gameId));
  };
  const onNext = () => {
    if (!game) return;
    if (room) {
      if (roomDto?.status === 'over') {
        setScreen('summary');
        return;
      }
      api.roomReady(room.code, room.token).then(applyRoomDto).catch(fail);
      return;
    }
    if (game.matchOver) {
      setScreen('summary');
    } else {
      void run(t('busy.next'), () => api.next(game.gameId));
    }
  };
  const onPlayAgain = () => {
    if (room) {
      leaveRoom();
      return;
    }
    setGame(null);
    setScreen('home');
  };

  const errorText = error
    ? error.code && STRICT_ERROR_CODES.has(error.code)
      ? t(`error.${error.code}`)
      : error.message || t('error.datasets')
    : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand" onClick={onPlayAgain} role="button" tabIndex={0}>
          <span className="brand-icon">✈</span> Flight Guesser
        </div>
        <div className="header-right">
          {roomDto && screen !== 'home' && (
            <span className="room-code-chip mono">{roomDto.code}</span>
          )}
          {game && screen === 'game' && (
            <div className="header-stats">
              <span>
                {t('header.flight')} <strong>{game.flightIndex}</strong>/{game.flightCount}
              </span>
              <span>
                {t('header.score')} <strong>{game.totalScore.toLocaleString()}</strong>
              </span>
            </div>
          )}
          <div className="seg lang-seg">
            <button className={lang === 'en' ? 'selected' : ''} onClick={() => setLang('en')}>
              EN
            </button>
            <button className={lang === 'zh' ? 'selected' : ''} onClick={() => setLang('zh')}>
              中文
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {screen === 'home' && (
          <HomeScreen
            ready={Boolean(datasets)}
            dailyMeta={dailyMeta}
            dailyDone={dailyDone}
            onStart={start}
            onStartDaily={startDaily}
            onOpenBoard={openBoard}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
          />
        )}
        {screen === 'lobby' && roomDto && (
          <div className="lobby">
            <h2>{t('room.lobby')}</h2>
            <div className="lobby-code mono">{roomDto.code}</div>
            <p className="dim">{t('room.share')}</p>
            <p className="lobby-waiting">{t('room.waiting')}</p>
            <button className="btn subtle" onClick={leaveRoom}>
              {t('room.cancel')}
            </button>
          </div>
        )}
        {screen === 'game' && game && datasets && (
          <GameScreen
            game={game}
            datasets={datasets}
            room={roomDto ? { opponent: roomDto.opponent, youReady: roomDto.youReady } : undefined}
            onGuess={onGuess}
            onClue={onClue}
            onGiveUp={onGiveUp}
            onNext={onNext}
          />
        )}
        {screen === 'summary' && game && (
          <MatchSummary game={game} room={roomDto} onOpenBoard={openBoard} onPlayAgain={onPlayAgain} />
        )}
      </main>

      {busy && (
        <div className="overlay">
          <div className="loading-card">
            <div className="radar" />
            <p>{busy}</p>
          </div>
        </div>
      )}
      {board && (
        <div className="overlay" onClick={() => setBoard(null)}>
          <div className="board-card" onClick={(e) => e.stopPropagation()}>
            <h2>
              {t('daily.title')} #{board.day} · {t('daily.board')}
            </h2>
            {board.entries.length === 0 ? (
              <p className="dim">{t('daily.empty')}</p>
            ) : (
              <div className="board-list">
                {board.entries.map((e, i) => (
                  <div key={`${e.name}-${i}`} className="board-row">
                    <span className="mono dim">#{i + 1}</span>
                    <span className="board-name">{e.name}</span>
                    <span>{e.solved ? '✅' : '❌'}</span>
                    <span className="mono board-score">{e.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn" onClick={() => setBoard(null)}>
              {t('daily.close')}
            </button>
          </div>
        </div>
      )}
      {errorText && (
        <div className="toast" onClick={() => setError(null)}>
          {errorText}
        </div>
      )}
    </div>
  );
}

const STRICT_ERROR_CODES = new Set([
  'NO_FLIGHT',
  'NO_PHOTO_FLIGHT',
  'NO_PHOTO_CONTACT',
  'CANT_AFFORD',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'datasets',
]);
