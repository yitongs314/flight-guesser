import { airlinesByIcao } from './data';
import type { Airline } from './types';

/**
 * Brand merging: regional carriers and secondary AOCs that fly under a
 * mainline brand. Players think "Delta", not "Endeavor Air".
 *
 * BRAND_REMAP: operators that fly for exactly one brand — the flight is
 * re-attributed to the brand for display, answers, and hints (guessing the
 * operator still counts).
 */
const BRAND_REMAP: Record<string, string> = {
  // US regionals with a single mainline partner
  EDV: 'DAL', // Endeavor Air → Delta
  ENY: 'AAL', // Envoy Air → American
  JIA: 'AAL', // PSA Airlines → American
  PDT: 'AAL', // Piedmont Airlines → American
  GJS: 'UAL', // GoJet → United
  UCA: 'UAL', // CommuteAir → United
  QXE: 'ASA', // Horizon Air → Alaska
  // Regional/secondary AOCs elsewhere
  CLH: 'DLH', // Lufthansa CityLine
  KLC: 'KLM', // KLM Cityhopper
  CFE: 'BAW', // BA CityFlyer
  HOP: 'AFR', // Air France HOP
  ANE: 'IBE', // Air Nostrum → Iberia
  JZA: 'ACA', // Jazz → Air Canada
  WEN: 'WJA', // WestJet Encore
  AKX: 'ANA', // ANA Wings
  JLJ: 'JAL', // J-Air → JAL
  SSQ: 'QFA', // Sunstate (QantasLink)
  NJS: 'QFA', // National Jet Systems (QantasLink)
  EAI: 'EIN', // Emerald Airlines → Aer Lingus
  SLI: 'AMX', // Aeroméxico Connect → Aeroméxico
  // Same-brand AOC splits
  EJU: 'EZY', // easyJet Europe
  EJH: 'EZY', // easyJet Switzerland
  RUK: 'RYR', // Ryanair UK
  RYS: 'RYR', // Buzz
  MAY: 'RYR', // Malta Air
  WUK: 'WZZ', // Wizz Air UK
  WMT: 'WZZ', // Wizz Air Malta
  WAZ: 'WZZ', // Wizz Air Abu Dhabi
  TVF: 'TRA', // Transavia France → Transavia
};

/**
 * Operators that fly for several brands at once — the callsign can't tell us
 * which one this flight is, so the operator stays the shown answer but any of
 * its mainline partners is accepted as a correct guess.
 */
const MULTI_BRAND: Record<string, string[]> = {
  SKW: ['UAL', 'DAL', 'AAL', 'ASA'], // SkyWest
  RPA: ['AAL', 'DAL', 'UAL'], // Republic Airways
  ASH: ['UAL', 'AAL'], // Mesa
  AWI: ['UAL', 'AAL'], // Air Wisconsin
};

export interface MergedAirline {
  airline: Airline;
  /** ICAO codes that count as a correct airline guess for this flight. */
  accepted: string[];
}

export function applyBrandMerge(operator: Airline): MergedAirline {
  const brandIcao = BRAND_REMAP[operator.icao];
  if (brandIcao) {
    const brand = airlinesByIcao.get(brandIcao);
    if (brand) return { airline: brand, accepted: [brand.icao, operator.icao] };
  }
  const partners = MULTI_BRAND[operator.icao];
  if (partners) {
    return {
      airline: operator,
      accepted: [operator.icao, ...partners.filter((icao) => airlinesByIcao.has(icao))],
    };
  }
  return { airline: operator, accepted: [operator.icao] };
}
