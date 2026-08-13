export type Mode = 'route' | 'departure' | 'arrival' | 'airline' | 'type' | 'photo' | 'fill';
export type Scoring = 'decay' | 'strikes' | 'race';

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
}

export interface Airline {
  icao: string;
  iata: string;
  name: string;
  callsign: string;
  country: string;
  countryCode: string;
  /** 'star' | 'oneworld' | 'skyteam' | '' */
  alliance: string;
}

export interface AircraftType {
  icao: string;
  name: string;
  manufacturer: string;
  family: string;
  class: string;
}

export interface Snapshot {
  lat: number;
  lon: number;
  altBaro: number;
  gs: number;
  track: number;
  baroRate: number;
  capturedAt: number;
}

export interface FlightRecord {
  hex: string;
  callsign: string;
  registration: string;
  type: AircraftType;
  airline: Airline;
  /** Airline ICAO codes accepted as correct guesses (brand merging). */
  acceptedAirlines: string[];
  origin: Airport;
  destination: Airport;
  snapshot: Snapshot;
  routeKm: number;
  flownKm: number;
  progressPct: number;
}

export interface ClueMap {
  lat: number;
  lon: number;
  zoom: number;
  track?: number;
}

/** A clue as built server-side: localizable key + params, with a shop price. */
export interface BuiltClue {
  index: number;
  key: string;
  price: number;
  params: Record<string, string | number>;
  map?: ClueMap;
  /** Public slot number for repeated clue kinds (e.g. airline hints). */
  tag?: number;
}

/** What the client sees: every clue's key and price, content only if purchased. */
export interface ClueOffer {
  index: number;
  key: string;
  price: number;
  purchased: boolean;
  params?: Record<string, string | number>;
  map?: ClueMap;
  tag?: number;
}

export interface Guess {
  origin?: string;
  destination?: string;
  airline?: string;
  type?: string;
}

export interface EndpointFeedback {
  guessed: string;
  guessedLabel: string;
  correct: boolean;
  distanceKm?: number;
  /** 8-way direction from the guess toward the truth (0=N, 1=NE, …). */
  bearing?: number;
}

export interface Feedback {
  kind: Mode;
  correct: boolean;
  atClue: number;
  origin?: EndpointFeedback;
  destination?: EndpointFeedback;
  airline?: {
    guessed: string;
    guessedLabel: string;
    correct: boolean;
    countryMatch?: boolean;
    allianceMatch?: boolean;
  };
  type?: {
    guessed: string;
    guessedLabel: string;
    correct: boolean;
    familyMatch?: boolean;
    manufacturerMatch?: boolean;
  };
}

export interface Photo {
  url: string;
  photographer: string;
  link: string;
}

export interface Reveal {
  callsign: string;
  registration: string;
  typeIcao: string;
  typeName: string;
  airlineIcao: string;
  airlineName: string;
  origin: Airport;
  destination: Airport;
  snapshot: Snapshot;
  routeKm: number;
  progressPct: number;
  photo: Photo | null;
  scoreEarned: number;
  solved: boolean;
}

export interface PhotoBoardDTO {
  cols: number;
  rows: number;
  width: number;
  height: number;
  tilePrice: number;
  /** Tile indices revealed so far, in purchase order. */
  revealed: number[];
}

export interface FlightStateDTO {
  status: 'playing' | 'solved' | 'failed';
  clues: ClueOffer[];
  /** Indices in the order they were purchased (clues or tiles). */
  purchasedOrder: number[];
  wrongGuesses: number;
  strikesLeft: number | null;
  strikesTotal: number | null;
  potentialScore: number;
  locked: {
    origin?: { icao: string; label: string };
    destination?: { icao: string; label: string };
    airline?: { icao: string; label: string };
    type?: { icao: string; label: string };
  };
  feedback: Feedback[];
  reveal: Reveal | null;
  photoBoard: PhotoBoardDTO | null;
}

export interface OpponentDTO {
  totalScore: number;
  flightIndex: number;
  ready: boolean;
  status: 'playing' | 'solved' | 'failed';
  potentialScore: number;
  purchasedCount: number;
  wrongGuesses: number;
  /** Set once the opponent's current flight is resolved. */
  scoreEarned: number | null;
}

export interface RoomDTO {
  code: string;
  status: 'waiting' | 'playing' | 'over';
  mode: Mode;
  scoring: Scoring;
  flightCount: number;
  youReady: boolean;
  you: GameDTO | null;
  opponent: OpponentDTO | null;
}

export interface GameDTO {
  gameId: string;
  mode: Mode;
  scoring: Scoring;
  flightCount: number;
  flightIndex: number;
  totalScore: number;
  daily?: { day: number };
  current: FlightStateDTO;
  past: Reveal[];
  matchOver: boolean;
}
