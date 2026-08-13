import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Airport, Airline, AircraftType } from './types';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

function load<T>(file: string): T {
  const full = path.join(DATA_DIR, file);
  try {
    return JSON.parse(readFileSync(full, 'utf8')) as T;
  } catch {
    throw new Error(`Missing or invalid ${full} — run \`npm run fetch-data\` first.`);
  }
}

export const airports: Airport[] = load('airports.json');
export const airlines: Airline[] = load('airlines.json');
export const aircraftTypes: AircraftType[] = load('aircraft-types.json');

export const airportsByIcao = new Map(airports.map((a) => [a.icao, a]));
export const airlinesByIcao = new Map(airlines.map((a) => [a.icao, a]));
export const typesByIcao = new Map(aircraftTypes.map((t) => [t.icao, t]));

export function airportLabel(a: Airport): string {
  return `${a.iata || a.icao} — ${a.name}`;
}
