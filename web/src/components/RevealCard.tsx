import { useI18n } from '../i18n';
import type { Reveal } from '../types';
import FlightCard from './FlightCard';

interface Props {
  reveal: Reveal;
  matchOver: boolean;
  /** Room mode: overrides the next-button label and can disable it. */
  nextLabel?: string;
  nextDisabled?: boolean;
  waitNote?: string;
  onNext: () => void;
}

export default function RevealCard({
  reveal,
  matchOver,
  nextLabel,
  nextDisabled,
  waitNote,
  onNext,
}: Props) {
  const { t } = useI18n();
  const r = reveal;
  return (
    <div className="overlay">
      <div className="reveal-card">
        <div className={`reveal-banner ${r.solved ? 'good' : 'bad'}`}>
          {r.solved ? t('reveal.solved', { pts: r.scoreEarned }) : t('reveal.failed')}
        </div>

        <FlightCard reveal={r} />

        {waitNote && <p className="map-note">{waitNote}</p>}
        <button className="btn primary big" disabled={nextDisabled} onClick={onNext}>
          {nextLabel ?? (matchOver ? t('reveal.final') : t('reveal.next'))}
        </button>
      </div>
    </div>
  );
}
