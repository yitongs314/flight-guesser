import { airlineHintPool } from './airlineHints';
import type { BuiltClue, ClueMap, FlightRecord, Mode } from './types';

// Airline intel: modes where the airline is a hidden target get purchasable
// hint slots, each drawn from that airline's pool for this session.
const HINT_SLOTS = 3;
const HINT_PRICE = 75;
const HINT_MODES: Mode[] = ['airline', 'photo', 'fill'];

// Shop prices: vaguer clues are cheaper, decisive ones cost real points.
const PRICES: Record<string, number> = {
  altitude: 50,
  speedHeading: 50,
  size: 50,
  progress: 75,
  routeLength: 100,
  coarseMap: 100,
  airlineCountry: 100,
  manufacturer: 100,
  originCountry: 125,
  destCountry: 125,
  family: 150,
  variant: 200,
  airlineName: 250,
  originAirport: 250,
  destAirport: 250,
  fineMap: 250,
};

type Draft = { key: string; params: Record<string, string | number>; map?: ClueMap } | null;
type Builder = (f: FlightRecord) => Draft;

const family: Builder = (f) => ({ key: 'family', params: { family: f.type.family } });

const altitude: Builder = (f) => {
  const { altBaro, baroRate } = f.snapshot;
  const phase = baroRate > 300 ? 'climb' : baroRate < -300 ? 'descend' : 'cruise';
  return { key: 'altitude', params: { phase, alt: altBaro } };
};

const speedHeading: Builder = (f) => ({
  key: 'speedHeading',
  params: {
    gs: Math.round(f.snapshot.gs),
    dir: Math.round((((f.snapshot.track % 360) + 360) % 360) / 45) % 8,
  },
});

const size: Builder = (f) => ({ key: 'size', params: { cls: f.type.class } });

const routeLength: Builder = (f) => ({
  key: 'routeLength',
  params: {
    bucket: f.routeKm < 1500 ? 'short' : f.routeKm < 4500 ? 'medium' : 'long',
    km: Math.round(f.routeKm / 100) * 100,
  },
});

const progress: Builder = (f) => ({ key: 'progress', params: { pct: f.progressPct } });

const coarseMap: Builder = (f) => ({
  key: 'coarseMap',
  params: {},
  map: {
    lat: Math.round(f.snapshot.lat / 3) * 3,
    lon: Math.round(f.snapshot.lon / 3) * 3,
    zoom: 2.5,
  },
});

const fineMap: Builder = (f) => ({
  key: 'fineMap',
  params: {},
  map: { lat: f.snapshot.lat, lon: f.snapshot.lon, zoom: 5.5, track: f.snapshot.track },
});

const airlineCountry: Builder = (f) =>
  f.airline.country
    ? {
        key: 'airlineCountry',
        params: { country: f.airline.country, code: f.airline.countryCode },
      }
    : null;

const airlineName: Builder = (f) => ({ key: 'airlineName', params: { airline: f.airline.name } });

const variant: Builder = (f) => ({ key: 'variant', params: { type: f.type.name } });

const manufacturer: Builder = (f) => ({
  key: 'manufacturer',
  params: { manufacturer: f.type.manufacturer },
});

const originCountry: Builder = (f) => ({
  key: 'originCountry',
  params: { country: f.origin.country, code: f.origin.countryCode },
});

const originAirport: Builder = (f) => ({
  key: 'originAirport',
  params: { airport: f.origin.name, iata: f.origin.iata, city: f.origin.city },
});

const destCountry: Builder = (f) => ({
  key: 'destCountry',
  params: { country: f.destination.country, code: f.destination.countryCode },
});

const destAirport: Builder = (f) => ({
  key: 'destAirport',
  params: { airport: f.destination.name, iata: f.destination.iata, city: f.destination.city },
});

// Per-mode clue shops, listed vague → specific. Clues that would trivially
// decode the hidden answer (or the answer itself) never appear in that mode's
// shop, and callsign/registration appear in none of them.
const DECKS: Record<Mode, Builder[]> = {
  route: [
    altitude,
    speedHeading,
    progress,
    routeLength,
    coarseMap,
    airlineCountry,
    family,
    variant,
    airlineName,
    fineMap,
  ],
  departure: [
    altitude,
    speedHeading,
    progress,
    routeLength,
    destCountry,
    coarseMap,
    family,
    destAirport,
    airlineName,
    fineMap,
  ],
  arrival: [
    altitude,
    speedHeading,
    progress,
    routeLength,
    originCountry,
    coarseMap,
    family,
    originAirport,
    airlineName,
    fineMap,
  ],
  airline: [
    altitude,
    speedHeading,
    size,
    routeLength,
    airlineCountry,
    originCountry,
    coarseMap,
    destCountry,
    family,
    variant,
    originAirport,
    destAirport,
  ],
  type: [
    altitude,
    speedHeading,
    size,
    routeLength,
    manufacturer,
    airlineCountry,
    coarseMap,
    originAirport,
    destAirport,
    airlineName,
  ],
  // Photo mode has no text clues — its reveals are image tiles.
  photo: [],
  // Fill-the-Flight: all four facts are hidden targets, so the shop sells only
  // situational clues that name none of them. Wrong-guess feedback (distance,
  // direction, country/alliance/family matches) is the main clue stream.
  fill: [altitude, speedHeading, size, progress, routeLength, coarseMap, fineMap],
};

export function buildClues(flight: FlightRecord, mode: Mode): BuiltClue[] {
  const clues: BuiltClue[] = DECKS[mode]
    .map((build) => build(flight))
    .filter((c): c is NonNullable<Draft> => c !== null)
    .map((c, index) => ({ ...c, index, price: PRICES[c.key] ?? 100 }));

  if (HINT_MODES.includes(mode)) {
    for (const [i, params] of airlineHintPool(flight.airline).slice(0, HINT_SLOTS).entries()) {
      clues.push({
        index: clues.length,
        key: 'airlineHint',
        price: HINT_PRICE,
        params,
        tag: i + 1,
      });
    }
  }
  return clues;
}
