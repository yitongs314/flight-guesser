import { useEffect, useRef, useState } from 'react';
import { api, type ApiError } from '../api';
import { useI18n } from '../i18n';
import { statsSummary } from '../stats';
import type { DailyInfo, Mode, Reveal, Scoring } from '../types';

const MODE_IDS: Mode[] = ['route', 'departure', 'arrival', 'airline', 'type', 'photo', 'fill'];

interface Props {
  ready: boolean;
  dailyMeta: DailyInfo | null;
  dailyDone: { score: number; solved: boolean } | null;
  onStart: (mode: Mode, scoring: Scoring, flightCount: number) => void;
  onStartDaily: (name: string) => void;
  onOpenBoard: () => void;
  onCreateRoom: (mode: Mode, scoring: Scoring, flightCount: number) => void;
  onJoinRoom: (code: string) => void;
}

export default function HomeScreen({
  ready,
  dailyMeta,
  dailyDone,
  onStart,
  onStartDaily,
  onOpenBoard,
  onCreateRoom,
  onJoinRoom,
}: Props) {
  const { t, aircraftName } = useI18n();
  const [mode, setMode] = useState<Mode>('route');
  const [scoring, setScoring] = useState<Scoring>('decay');
  const [flightCount, setFlightCount] = useState(5);
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState(() => localStorage.getItem('fg-name') ?? '');
  const stats = statsSummary();
  const [spot, setSpot] = useState<Reveal | null>(null);
  const [spotBusy, setSpotBusy] = useState(false);
  const [spotError, setSpotError] = useState<string | null>(null);

  const loadSpotlight = async () => {
    setSpotBusy(true);
    setSpotError(null);
    try {
      setSpot(await api.spotlight());
    } catch (e) {
      const err = e as ApiError;
      setSpotError(err.code === 'NO_FLIGHT' ? t('error.NO_FLIGHT') : err.message);
    } finally {
      setSpotBusy(false);
    }
  };

  // A random flight loads automatically when the menu appears.
  const spotInit = useRef(false);
  useEffect(() => {
    if (spotInit.current) return;
    spotInit.current = true;
    void loadSpotlight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="home">
      <p className="tagline">
        {t('home.tagline1')}
        <strong>{t('home.tagline2')}</strong>
        {t('home.tagline3')}
      </p>

      <div className="home-grid">
        <div className="home-main">
          {dailyMeta && (
            <div className="daily-banner">
              <span className="daily-title">
                {t('daily.title')} #{dailyMeta.day}
              </span>
              <span className="dim">{t(`mode.${dailyMeta.mode}.title`)}</span>
              <span className="dim">{t('daily.players', { n: dailyMeta.players })}</span>
              <span className="daily-spacer" />
              {dailyDone ? (
                <>
                  <span className={dailyDone.solved ? 'good-text' : 'dim'}>
                    {t('daily.played')} {dailyDone.solved ? '✅' : '❌'}{' '}
                    {dailyDone.score.toLocaleString()}
                  </span>
                  <button className="btn" onClick={onOpenBoard}>
                    {t('daily.board')}
                  </button>
                </>
              ) : (
                <>
                  <input
                    className="ac-input daily-name"
                    placeholder={t('daily.namePh')}
                    value={name}
                    maxLength={20}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <button
                    className="btn primary"
                    disabled={!ready || !name.trim()}
                    onClick={() => onStartDaily(name.trim())}
                  >
                    {t('daily.play')}
                  </button>
                </>
              )}
            </div>
          )}
          <h2>{t('home.pickMode')}</h2>
          <div className="mode-grid">
            {MODE_IDS.map((id) => (
              <button
                key={id}
                className={`mode-card ${mode === id ? 'selected' : ''}`}
                onClick={() => setMode(id)}
              >
                <h3>{t(`mode.${id}.title`)}</h3>
                <p>{t(`mode.${id}.desc`)}</p>
              </button>
            ))}
          </div>

          <div className="setup-row">
            <div className="setup-block">
              <h2>{t('home.scoring')}</h2>
              <div className="seg">
                <button
                  className={scoring === 'decay' ? 'selected' : ''}
                  onClick={() => setScoring('decay')}
                  title={t('scoring.decay.tip')}
                >
                  {t('scoring.decay')}
                </button>
                <button
                  className={scoring === 'strikes' ? 'selected' : ''}
                  onClick={() => setScoring('strikes')}
                  title={t('scoring.strikes.tip')}
                >
                  {t('scoring.strikes')}
                </button>
                <button
                  className={scoring === 'race' ? 'selected' : ''}
                  onClick={() => setScoring('race')}
                  title={t('scoring.race.tip')}
                >
                  {t('scoring.race')}
                </button>
              </div>
            </div>
            <div className="setup-block">
              <h2>{t('home.flights')}</h2>
              <div className="seg">
                {[1, 3, 5, 10].map((n) => (
                  <button
                    key={n}
                    className={flightCount === n ? 'selected' : ''}
                    onClick={() => setFlightCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            className="btn primary start-btn"
            disabled={!ready || scoring === 'race'}
            title={scoring === 'race' ? t('scoring.race.tip') : undefined}
            onClick={() => onStart(mode, scoring, flightCount)}
          >
            {ready ? t('home.start') : t('home.loading')}
          </button>
        </div>

        <aside className="home-side">
          <h2>{t('room.section')}</h2>
          <div className="side-box">
            <button
              className="btn side-wide"
              disabled={!ready}
              onClick={() => onCreateRoom(mode, scoring, flightCount)}
            >
              {t('room.create')}
            </button>
            <div className="room-row">
              <input
                className="ac-input room-code-input mono"
                placeholder={t('room.codePh')}
                value={joinCode}
                maxLength={6}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
              <button
                className="btn"
                disabled={!ready || joinCode.trim().length < 6}
                onClick={() => onJoinRoom(joinCode.trim())}
              >
                {t('room.join')}
              </button>
            </div>
            <p className="side-hint">{t('room.hint')}</p>
          </div>

          <h2>{t('home.spotlight')}</h2>
          <div className="side-box">
            {spot && (
              <div className="spot-mini">
                {spot.photo && <img className="spot-thumb" src={spot.photo.url} alt="" />}
                <div className="spot-info">
                  <div>
                    <span className="mono spot-callsign">{spot.callsign}</span> {spot.airlineName}
                  </div>
                  <div className="dim">
                    {aircraftName(spot.typeName)} · <span className="mono">{spot.registration}</span>
                  </div>
                  <div>
                    <span className="mono">{spot.origin.iata}</span> →{' '}
                    <span className="mono">{spot.destination.iata}</span> ·{' '}
                    {t('reveal.flown', { pct: spot.progressPct })}
                  </div>
                  {spot.photo && (
                    <div className="spot-credit">
                      © {spot.photo.photographer} · Planespotters.net
                    </div>
                  )}
                </div>
              </div>
            )}
            {spot?.registration && (
              <div className="spot-links">
                <a
                  href={`https://www.jetphotos.com/photo/keyword/${encodeURIComponent(spot.registration)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  JetPhotos ↗
                </a>
                <a
                  href={`https://www.flightradar24.com/data/aircraft/${encodeURIComponent(spot.registration.toLowerCase())}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Flightradar24 ↗
                </a>
              </div>
            )}
            {spotError && <p className="spot-error">{spotError}</p>}
            <button className="btn side-wide" disabled={spotBusy} onClick={loadSpotlight}>
              {spotBusy ? t('home.spotlightBusy') : t('home.spotlightAgain')}
            </button>
          </div>
          {stats.played > 0 && (
            <p className="stats-line">
              {t('stats.line', { played: stats.played, solved: stats.solved, avg: stats.avg })}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
