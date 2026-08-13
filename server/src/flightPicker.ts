import { applyBrandMerge } from './brands';
import { airportsByIcao, airlinesByIcao, typesByIcao } from './data';
import type { Airline, FlightRecord, Snapshot } from './types';
import { haversineKm, shuffle, sleep, weightedOrder } from './util';

// Busy airspace cells to sample from. Radius of each query is 250 nm.
const REGIONS = [
  { name: 'US Northeast', lat: 40.5, lon: -75.5, weight: 5 },
  { name: 'US Southeast', lat: 33.5, lon: -84.4, weight: 4 },
  { name: 'US Central', lat: 35.2, lon: -97.5, weight: 4 },
  { name: 'US West', lat: 36.5, lon: -119.5, weight: 4 },
  { name: 'US Northwest', lat: 45.5, lon: -122.5, weight: 2 },
  { name: 'Eastern Canada', lat: 44.5, lon: -79.5, weight: 2 },
  { name: 'Mexico', lat: 19.8, lon: -99.0, weight: 2 },
  { name: 'Caribbean', lat: 20.0, lon: -72.0, weight: 1 },
  { name: 'Brazil', lat: -23.3, lon: -46.5, weight: 2 },
  { name: 'Andes', lat: -8.0, lon: -76.0, weight: 1 },
  { name: 'UK & Ireland', lat: 52.5, lon: -1.5, weight: 4 },
  { name: 'France & Benelux', lat: 49.5, lon: 3.0, weight: 4 },
  { name: 'Iberia', lat: 40.0, lon: -3.5, weight: 3 },
  { name: 'Central Europe', lat: 48.5, lon: 11.5, weight: 4 },
  { name: 'Italy & Adriatic', lat: 43.5, lon: 12.5, weight: 2 },
  { name: 'Scandinavia', lat: 58.5, lon: 12.0, weight: 2 },
  { name: 'Eastern Europe', lat: 50.5, lon: 21.0, weight: 2 },
  { name: 'Greece & Turkey', lat: 38.5, lon: 28.0, weight: 2 },
  { name: 'Middle East', lat: 25.5, lon: 52.5, weight: 3 },
  { name: 'India', lat: 20.5, lon: 77.5, weight: 3 },
  { name: 'Southeast Asia', lat: 3.0, lon: 103.0, weight: 3 },
  { name: 'Japan', lat: 35.5, lon: 138.5, weight: 3 },
  { name: 'Korea', lat: 36.5, lon: 127.5, weight: 2 },
  { name: 'China East', lat: 31.5, lon: 118.5, weight: 2 },
  { name: 'Australia East', lat: -33.0, lon: 149.5, weight: 2 },
  { name: 'South Africa', lat: -27.5, lon: 27.5, weight: 1 },
];

interface RawAc {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  baro_rate?: number;
  lat?: number;
  lon?: number;
}

interface AdsbdbAirport {
  icao_code?: string;
}

interface Flightroute {
  airline?: { icao?: string } | null;
  origin?: AdsbdbAirport;
  destination?: AdsbdbAirport;
}

export class PickError extends Error {}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'user-agent': 'flight-guesser-game/0.1 (hobby project)' },
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function fetchCandidates(lat: number, lon: number): Promise<RawAc[]> {
  const body = (await fetchJson(`https://api.adsb.lol/v2/point/${lat}/${lon}/250`)) as {
    ac?: RawAc[];
  };
  return body.ac ?? [];
}

const routeCache = new Map<string, { at: number; fr: Flightroute | null }>();
const ROUTE_TTL_MS = 6 * 3600 * 1000;

async function adsbdbRoute(callsign: string): Promise<Flightroute | null> {
  const hit = routeCache.get(callsign);
  if (hit && Date.now() - hit.at < ROUTE_TTL_MS) return hit.fr;
  let fr: Flightroute | null = null;
  try {
    const res = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'flight-guesser-game/0.1 (hobby project)' },
    });
    if (res.ok) {
      const body = (await res.json()) as { response?: { flightroute?: Flightroute } | string };
      if (typeof body.response === 'object' && body.response?.flightroute) {
        fr = body.response.flightroute;
      }
    }
  } catch {
    // treat as unknown; cached so we don't hammer the API
  }
  routeCache.set(callsign, { at: Date.now(), fr });
  return fr;
}

function plausible(ac: RawAc): boolean {
  return Boolean(
    ac.hex &&
      ac.flight &&
      /^[A-Z]{3}\d/.test(ac.flight.trim()) &&
      typeof ac.alt_baro === 'number' &&
      ac.alt_baro > 10_000 &&
      (ac.gs ?? 0) > 150 &&
      ac.lat != null &&
      ac.lon != null &&
      ac.t &&
      typesByIcao.has(ac.t),
  );
}

function resolveAirline(fr: Flightroute, callsign: string): Airline | undefined {
  if (fr.airline?.icao) {
    const byRoute = airlinesByIcao.get(fr.airline.icao);
    if (byRoute) return byRoute;
  }
  return airlinesByIcao.get(callsign.slice(0, 3));
}

async function enrich(ac: RawAc): Promise<FlightRecord | null> {
  const callsign = ac.flight!.trim();
  const fr = await adsbdbRoute(callsign);
  if (!fr?.origin?.icao_code || !fr.destination?.icao_code) return null;

  // Both airports and the airline must exist in our own datasets, so the
  // guess autocomplete always contains the answer.
  const origin = airportsByIcao.get(fr.origin.icao_code);
  const destination = airportsByIcao.get(fr.destination.icao_code);
  if (!origin || !destination || origin.icao === destination.icao) return null;
  const operator = resolveAirline(fr, callsign);
  if (!operator) return null;
  // Regional carriers fly under mainline brands; merge them.
  const { airline, accepted } = applyBrandMerge(operator);

  const pos = { lat: ac.lat!, lon: ac.lon! };
  const routeKm = haversineKm(origin, destination);
  if (routeKm < 150) return null;
  const flownKm = haversineKm(origin, pos);
  const remainingKm = haversineKm(pos, destination);
  // Guards against stale callsign→route mappings: the aircraft must actually
  // be somewhere between the two airports.
  if (flownKm + remainingKm > routeKm * 1.8 + 250) return null;

  return {
    hex: ac.hex,
    callsign,
    registration: (ac.r ?? '').trim(),
    type: typesByIcao.get(ac.t!)!,
    airline,
    acceptedAirlines: accepted,
    origin,
    destination,
    snapshot: {
      lat: pos.lat,
      lon: pos.lon,
      altBaro: ac.alt_baro as number,
      gs: ac.gs ?? 0,
      track: ac.track ?? 0,
      baroRate: ac.baro_rate ?? 0,
      capturedAt: Date.now(),
    },
    routeKm,
    flownKm,
    progressPct: Math.round(Math.min(Math.max(flownKm / routeKm, 0), 1) * 100),
  };
}

/** The aircraft's position right now, for the reveal map. Null if it's gone quiet. */
export async function fetchLiveSnapshot(hex: string): Promise<Snapshot | null> {
  try {
    const body = (await fetchJson(`https://api.adsb.lol/v2/hex/${hex}`)) as { ac?: RawAc[] };
    const ac = body.ac?.[0];
    if (!ac || ac.lat == null || ac.lon == null) return null;
    return {
      lat: ac.lat,
      lon: ac.lon,
      altBaro: typeof ac.alt_baro === 'number' ? ac.alt_baro : 0,
      gs: ac.gs ?? 0,
      track: ac.track ?? 0,
      baroRate: ac.baro_rate ?? 0,
      capturedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export async function pickFlight(usedHexes: Set<string>): Promise<FlightRecord> {
  for (const region of weightedOrder(REGIONS).slice(0, 8)) {
    let candidates: RawAc[];
    try {
      candidates = await fetchCandidates(region.lat, region.lon);
    } catch {
      continue;
    }
    const good = shuffle(candidates.filter(plausible)).filter((ac) => !usedHexes.has(ac.hex));
    let tried = 0;
    for (const ac of good) {
      if (tried >= 10) break;
      tried++;
      const record = await enrich(ac);
      if (record) {
        usedHexes.add(record.hex);
        return record;
      }
      await sleep(150);
    }
  }
  throw new PickError('No suitable live flight found right now — try again in a minute.');
}
