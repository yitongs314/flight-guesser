import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import type { Datasets, FlightStateDTO, GuessPayload, Mode } from '../types';
import Autocomplete, { type ACItem } from './Autocomplete';

interface Props {
  mode: Mode;
  datasets: Datasets;
  locked: FlightStateDTO['locked'];
  disabled: boolean;
  onGuess: (guess: GuessPayload) => void;
}

export default function GuessPanel({ mode, datasets, locked, disabled, onGuess }: Props) {
  const { t, countryName, aircraftName } = useI18n();
  const [originSel, setOriginSel] = useState<ACItem | null>(null);
  const [destSel, setDestSel] = useState<ACItem | null>(null);
  const [airlineSel, setAirlineSel] = useState<ACItem | null>(null);
  const [typeSel, setTypeSel] = useState<ACItem | null>(null);

  useEffect(() => {
    if (locked.origin) setOriginSel(null);
  }, [locked.origin]);
  useEffect(() => {
    if (locked.destination) setDestSel(null);
  }, [locked.destination]);
  useEffect(() => {
    if (locked.airline) setAirlineSel(null);
  }, [locked.airline]);
  useEffect(() => {
    if (locked.type) setTypeSel(null);
  }, [locked.type]);

  const airportItems = useMemo<ACItem[]>(
    () =>
      datasets.airports.map((a) => ({
        code: a.icao,
        codes: [a.iata, a.icao].filter(Boolean).map((c) => c.toLowerCase()),
        label: `${a.iata || a.icao} — ${a.name}`,
        sub: [a.city, countryName(a.country, a.countryCode)].filter(Boolean).join(', '),
        haystack: ` ${a.iata} ${a.icao} ${a.name} ${a.city} ${a.country}`.toLowerCase(),
      })),
    [datasets.airports, countryName],
  );
  const airlineItems = useMemo<ACItem[]>(
    () =>
      datasets.airlines.map((a) => ({
        code: a.icao,
        codes: [a.iata, a.icao].filter(Boolean).map((c) => c.toLowerCase()),
        label: a.name,
        sub: [a.icao, a.iata, countryName(a.country, a.countryCode)].filter(Boolean).join(' · '),
        haystack: ` ${a.icao} ${a.iata} ${a.name} ${a.country}`.toLowerCase(),
      })),
    [datasets.airlines, countryName],
  );
  const typeItems = useMemo<ACItem[]>(
    () =>
      datasets.aircraftTypes.map((tp) => ({
        code: tp.icao,
        codes: [tp.icao.toLowerCase()],
        label: `${tp.icao} — ${aircraftName(tp.name)}`,
        sub: aircraftName(tp.manufacturer),
        haystack: ` ${tp.icao} ${tp.name} ${tp.manufacturer} ${tp.family}`.toLowerCase(),
      })),
    [datasets.aircraftTypes, aircraftName],
  );

  const wantOrigin = mode === 'route' || mode === 'departure' || mode === 'fill';
  const wantDest = mode === 'route' || mode === 'arrival' || mode === 'fill';
  const wantAirline = mode === 'airline' || mode === 'photo' || mode === 'fill';
  const wantType = mode === 'type' || mode === 'photo' || mode === 'fill';

  const canSubmit =
    !disabled &&
    (mode === 'photo' || mode === 'fill'
      ? Boolean(originSel || destSel || airlineSel || typeSel)
      : mode === 'airline'
        ? Boolean(airlineSel)
        : mode === 'type'
          ? Boolean(typeSel)
          : (!wantOrigin || Boolean(locked.origin) || Boolean(originSel)) &&
            (!wantDest || Boolean(locked.destination) || Boolean(destSel)) &&
            Boolean(originSel || destSel));

  const submit = () => {
    const guess: GuessPayload = {};
    if (wantOrigin && !locked.origin && originSel) guess.origin = originSel.code;
    if (wantDest && !locked.destination && destSel) guess.destination = destSel.code;
    if (wantAirline && !locked.airline && airlineSel) guess.airline = airlineSel.code;
    if (wantType && !locked.type && typeSel) guess.type = typeSel.code;
    onGuess(guess);
  };

  return (
    <div className="guess-panel">
      {wantOrigin &&
        (locked.origin ? (
          <div className="locked-chip">✓ {locked.origin.label}</div>
        ) : (
          <Autocomplete
            items={airportItems}
            placeholder={t(mode === 'departure' ? 'guess.depQ' : 'guess.dep')}
            selected={originSel}
            onSelect={setOriginSel}
            disabled={disabled}
          />
        ))}
      {wantDest &&
        (locked.destination ? (
          <div className="locked-chip">✓ {locked.destination.label}</div>
        ) : (
          <Autocomplete
            items={airportItems}
            placeholder={t(mode === 'arrival' ? 'guess.arrQ' : 'guess.arr')}
            selected={destSel}
            onSelect={setDestSel}
            disabled={disabled}
          />
        ))}
      {wantAirline &&
        (locked.airline ? (
          <div className="locked-chip">✓ {locked.airline.label}</div>
        ) : (
          <Autocomplete
            items={airlineItems}
            placeholder={t('guess.airline')}
            selected={airlineSel}
            onSelect={setAirlineSel}
            disabled={disabled}
          />
        ))}
      {wantType &&
        (locked.type ? (
          <div className="locked-chip">✓ {aircraftName(locked.type.label)}</div>
        ) : (
          <Autocomplete
            items={typeItems}
            placeholder={t('guess.type')}
            selected={typeSel}
            onSelect={setTypeSel}
            disabled={disabled}
          />
        ))}
      <button className="btn primary" disabled={!canSubmit} onClick={submit}>
        {t('guess.submit')}
      </button>
    </div>
  );
}
