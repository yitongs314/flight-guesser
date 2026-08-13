import { useI18n } from '../i18n';
import type { Reveal } from '../types';
import MapPanel from './MapPanel';

/** The flight fact sheet: photo, facts grid, route map, photo links.
 * Shared by the post-flight reveal card and the home-screen spotlight. */
export default function FlightCard({ reveal }: { reveal: Reveal }) {
  const { t, aircraftName } = useI18n();
  const r = reveal;
  return (
    <>
      <div className={`reveal-body ${r.photo ? '' : 'no-photo'}`}>
        {r.photo && (
          <figure className="reveal-photo">
            <img src={r.photo.url} alt={`${r.typeName} (${r.registration})`} />
            <figcaption>
              {t('reveal.photoBy')} {r.photo.photographer} ·{' '}
              <a href={r.photo.link} target="_blank" rel="noreferrer">
                Planespotters.net
              </a>
            </figcaption>
          </figure>
        )}

        <div className="reveal-facts">
        <div className="fact">
          <span className="fact-label">{t('reveal.flight')}</span>
          <span className="mono">{r.callsign}</span>
        </div>
        <div className="fact">
          <span className="fact-label">{t('reveal.airline')}</span>
          <span>{r.airlineName}</span>
        </div>
        <div className="fact">
          <span className="fact-label">{t('reveal.aircraft')}</span>
          <span>
            {aircraftName(r.typeName)} <span className="mono dim">({r.typeIcao})</span>
          </span>
        </div>
        <div className="fact">
          <span className="fact-label">{t('reveal.registration')}</span>
          <span className="mono">{r.registration || '—'}</span>
        </div>
        <div className="fact wide">
          <span className="fact-label">{t('reveal.route')}</span>
          <span>
            {r.origin.name} <span className="mono">({r.origin.iata})</span> → {r.destination.name}{' '}
            <span className="mono">({r.destination.iata})</span>
          </span>
        </div>
        <div className="fact">
          <span className="fact-label">{t('reveal.distance')}</span>
          <span>{t('reveal.km', { km: r.routeKm })}</span>
        </div>
        <div className="fact">
          <span className="fact-label">{t('reveal.progress')}</span>
          <span>{t('reveal.flown', { pct: r.progressPct })}</span>
        </div>
        </div>
      </div>

      <MapPanel key={r.callsign} reveal={r} />
      <p className="map-note">{t('reveal.mapNote')}</p>

      {r.registration && (
        <div className="reveal-links">
          {t('reveal.morePhotos', { reg: r.registration })}
          {r.photo && (
            <a href={r.photo.link} target="_blank" rel="noreferrer">
              Planespotters ↗
            </a>
          )}
          <a
            href={`https://www.jetphotos.com/photo/keyword/${encodeURIComponent(r.registration)}`}
            target="_blank"
            rel="noreferrer"
          >
            JetPhotos ↗
          </a>
          <a
            href={`https://www.flightradar24.com/data/aircraft/${encodeURIComponent(r.registration.toLowerCase())}`}
            target="_blank"
            rel="noreferrer"
          >
            Flightradar24 ↗
          </a>
        </div>
      )}
    </>
  );
}
