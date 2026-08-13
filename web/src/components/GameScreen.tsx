import { useI18n } from '../i18n';
import type { Datasets, Feedback, GameDTO, GuessPayload, OpponentDTO } from '../types';
import GuessPanel from './GuessPanel';
import MapPanel from './MapPanel';
import PhotoBoard from './PhotoBoard';
import RevealCard from './RevealCard';

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

function EndpointChip({ fb }: { fb: NonNullable<Feedback['origin']> }) {
  const { t } = useI18n();
  return (
    <span className={`fb-chip ${fb.correct ? 'good' : 'bad'}`}>
      {fb.correct ? '✓' : '✗'} {fb.guessed}
      {fb.distanceKm !== undefined && ` · ${t('fb.kmOff', { km: fb.distanceKm })}`}
      {fb.bearing !== undefined && ` ${ARROWS[fb.bearing]}`}
    </span>
  );
}

function FeedbackRow({ fb }: { fb: Feedback }) {
  const { t, aircraftName } = useI18n();
  return (
    <div className="feedback-row">
      <span className="fb-clue">
        {t(fb.kind === 'photo' ? 'fb.tile' : 'fb.clue', { n: fb.atClue })}
      </span>
      {fb.origin && <EndpointChip fb={fb.origin} />}
      {fb.destination && <EndpointChip fb={fb.destination} />}
      {fb.airline && (
        <span className={`fb-chip ${fb.airline.correct ? 'good' : 'bad'}`}>
          {fb.airline.correct ? '✓' : '✗'} {fb.airline.guessedLabel}
          {fb.airline.countryMatch && ` · ${t('fb.countryMatch')}`}
          {fb.airline.allianceMatch && ` · ${t('fb.allianceMatch')}`}
        </span>
      )}
      {fb.type && (
        <span className={`fb-chip ${fb.type.correct ? 'good' : 'bad'}`}>
          {fb.type.correct ? '✓' : '✗'} {aircraftName(fb.type.guessedLabel)}
          {fb.type.familyMatch
            ? ` · ${t('fb.family')}`
            : fb.type.manufacturerMatch
              ? ` · ${t('fb.mfrMatch')}`
              : ''}
        </span>
      )}
    </div>
  );
}

function OpponentStrip({ opp }: { opp: OpponentDTO }) {
  const { t } = useI18n();
  return (
    <div className="opp-strip">
      <span className="opp-name">{t('room.opp')}</span>
      <span>
        {t('header.score')} <strong>{opp.totalScore.toLocaleString()}</strong>
      </span>
      <span>{t('room.flightN', { n: opp.flightIndex })}</span>
      <span>{t('room.bought', { n: opp.purchasedCount })}</span>
      <span>{t('room.wrong', { n: opp.wrongGuesses })}</span>
      {opp.status === 'playing' ? (
        <span className="opp-playing">{t('room.oppPlaying')}</span>
      ) : (
        <span className="opp-done">
          {t('room.oppDone')}
          {opp.scoreEarned !== null && ` +${opp.scoreEarned.toLocaleString()}`}
        </span>
      )}
    </div>
  );
}

interface Props {
  game: GameDTO;
  datasets: Datasets;
  room?: { opponent: OpponentDTO | null; youReady: boolean };
  onGuess: (guess: GuessPayload) => void;
  onClue: (index: number) => void;
  onGiveUp: () => void;
  onNext: () => void;
}

export default function GameScreen({
  game,
  datasets,
  room,
  onGuess,
  onClue,
  onGiveUp,
  onNext,
}: Props) {
  const { t, clueLabel, clueText } = useI18n();
  const s = game.current;
  const playing = s.status === 'playing';
  const isPhoto = game.mode === 'photo';
  const feedbackNewestFirst = [...s.feedback].reverse();

  // Latest purchased map clue drives the map panel.
  const mapClue = [...s.purchasedOrder]
    .reverse()
    .map((i) => s.clues.find((c) => c.index === i))
    .find((c) => c?.map);

  const oppStillPlaying = room?.opponent?.status === 'playing';
  const nextLabel = room
    ? room.youReady
      ? t('room.readyWaiting')
      : game.matchOver && !oppStillPlaying
        ? t('room.final')
        : t('room.ready')
    : undefined;

  return (
    <div className="game">
      {room?.opponent && <OpponentStrip opp={room.opponent} />}
      <div className="game-status">
        {isPhoto ? (
          <span className="tile-count">
            {t('game.tiles', {
              revealed: s.photoBoard?.revealed.length ?? 0,
              total: (s.photoBoard?.cols ?? 0) * (s.photoBoard?.rows ?? 0),
            })}
          </span>
        ) : (
          <span className="tile-count">{t('game.clueHelp')}</span>
        )}
        <div className="status-right">
          {s.strikesLeft !== null && (
            <span className="strikes">
              {'●'.repeat(s.strikesLeft)}
              {'○'.repeat(Math.max((s.strikesTotal ?? 3) - s.strikesLeft, 0))} {t('game.strikes')}
            </span>
          )}
          <span className="potential">
            {t('game.solve.pre')}
            <strong>{s.potentialScore.toLocaleString()}</strong>
            {t('game.solve.post')}
          </span>
        </div>
      </div>

      <div className="game-grid">
        <section className="clues-col">
          <h2>{isPhoto ? t('game.photoHunt') : t('game.clueShop')}</h2>
          {isPhoto && (
            <div className="clue-card">
              <div>
                <div className="clue-label">{t('game.howItWorks')}</div>
                <div className="clue-text">
                  {t('game.photoHelp', { price: s.photoBoard?.tilePrice ?? 50 })}
                </div>
              </div>
            </div>
          )}
          {s.clues.length > 0 && (
            <div className="clue-feed">
              {s.clues.map((offer) => {
                const label = `${clueLabel(offer.key)}${offer.tag ? ` ${offer.tag}` : ''}`;
                return offer.purchased ? (
                  <div key={offer.index} className="clue-card bought">
                    <div>
                      <div className="clue-label">{label}</div>
                      <div className="clue-text">{clueText(offer)}</div>
                    </div>
                  </div>
                ) : (
                  <button
                    key={offer.index}
                    className="clue-card clue-offer"
                    disabled={!playing || s.potentialScore - offer.price < 100}
                    onClick={() => onClue(offer.index)}
                  >
                    <span className="clue-label">{label}</span>
                    <span className="clue-price">−{offer.price}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="clue-actions">
            <button className="btn subtle" disabled={!playing} onClick={onGiveUp}>
              {t('game.giveUp')}
            </button>
          </div>
        </section>

        <section className="play-col">
          {isPhoto && s.photoBoard ? (
            <PhotoBoard
              gameId={game.gameId}
              flightIndex={game.flightIndex}
              board={s.photoBoard}
              disabled={!playing}
              budget={s.potentialScore}
              onBuy={onClue}
            />
          ) : mapClue?.map ? (
            <MapPanel key={JSON.stringify(mapClue.map)} view={mapClue.map} />
          ) : (
            <div className="map-placeholder">
              <div className="radar" />
              <p>{t('game.mapPlaceholder')}</p>
            </div>
          )}

          <GuessPanel
            // Remount on every new flight so selections never carry over.
            key={`${game.gameId}:${game.flightIndex}`}
            mode={game.mode}
            datasets={datasets}
            locked={s.locked}
            disabled={!playing}
            onGuess={onGuess}
          />

          {feedbackNewestFirst.length > 0 && (
            <div className="feedback-list">
              {feedbackNewestFirst.map((fb, i) => (
                <FeedbackRow key={feedbackNewestFirst.length - i} fb={fb} />
              ))}
            </div>
          )}
        </section>
      </div>

      {s.reveal && (
        <RevealCard
          reveal={s.reveal}
          matchOver={game.matchOver}
          nextLabel={nextLabel}
          nextDisabled={Boolean(room?.youReady)}
          waitNote={room && oppStillPlaying ? t('room.waitOpp') : undefined}
          onNext={onNext}
        />
      )}
    </div>
  );
}
