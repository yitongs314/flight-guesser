import { useState } from 'react';
import { useI18n } from '../i18n';
import type { GameDTO, RoomDTO } from '../types';

interface Props {
  game: GameDTO;
  room?: RoomDTO | null;
  onOpenBoard?: () => void;
  onPlayAgain: () => void;
}

export default function MatchSummary({ game, room, onOpenBoard, onPlayAgain }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const shareResult = () => {
    const c = game.current;
    const solved = c.reveal?.solved ?? false;
    const text =
      `Flight Guesser Daily #${game.daily?.day} ${solved ? '✅' : '❌'} ${game.totalScore} pts\n` +
      `${'🟨'.repeat(Math.min(c.purchasedOrder.length, 12))}${'🟥'.repeat(Math.min(c.wrongGuesses, 6))}${solved ? '🛫' : ''}`;
    navigator.clipboard
      .writeText(text)
      .then(() => setCopied(true))
      .catch(() => {});
  };
  const opp = room?.opponent;
  const verdict = opp
    ? game.totalScore > opp.totalScore
      ? t('room.win')
      : game.totalScore < opp.totalScore
        ? t('room.lose')
        : t('room.draw')
    : null;
  return (
    <div className="summary">
      <h1>{t('summary.title')}</h1>
      {verdict && <div className={`summary-verdict ${game.totalScore >= (opp?.totalScore ?? 0) ? 'good' : 'bad'}`}>{verdict}</div>}
      {opp ? (
        <div className="summary-duel">
          <div>
            <span className="fact-label">{t('room.you')}</span>
            <div className="summary-total">{game.totalScore.toLocaleString()}</div>
          </div>
          <div>
            <span className="fact-label">{t('room.opp')}</span>
            <div className="summary-total dim">{opp.totalScore.toLocaleString()}</div>
          </div>
        </div>
      ) : (
        <div className="summary-total">{game.totalScore.toLocaleString()}</div>
      )}
      <div className="summary-flights">
        {game.past.map((r, i) => (
          <div key={i} className="summary-row">
            <span className="mono dim">#{i + 1}</span>
            <span className="mono">{r.callsign}</span>
            <span>
              {r.origin.iata} → {r.destination.iata}
            </span>
            <span className="mono dim">{r.typeIcao}</span>
            <span className={`summary-score ${r.solved ? 'good' : 'bad'}`}>
              {r.solved ? `+${r.scoreEarned.toLocaleString()}` : '0'}
            </span>
          </div>
        ))}
      </div>
      {game.daily && (
        <div className="daily-actions">
          <button className="btn" onClick={shareResult}>
            {copied ? t('daily.shared') : t('daily.share')}
          </button>
          {onOpenBoard && (
            <button className="btn" onClick={onOpenBoard}>
              {t('daily.board')}
            </button>
          )}
        </div>
      )}
      <button className="btn primary big" onClick={onPlayAgain}>
        {t('summary.playAgain')}
      </button>
    </div>
  );
}
