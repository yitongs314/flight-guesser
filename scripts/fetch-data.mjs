// Downloads open datasets and generates the JSON files the server uses:
//   server/data/airports.json        OurAirports, medium+large airports with scheduled service
//   server/data/airlines.json        OpenFlights active airlines + curated top-ups
//   server/data/aircraft-types.json  curated list of guessable airliner types
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'data');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      }
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

async function fetchCountries() {
  const csv = await fetchText('https://davidmegginson.github.io/ourairports-data/countries.csv');
  const rows = parseCsv(csv);
  const head = rows[0];
  const iCode = head.indexOf('code');
  const iName = head.indexOf('name');
  const byCode = new Map();
  const codeByName = new Map();
  for (const r of rows.slice(1)) {
    byCode.set(r[iCode], r[iName]);
    codeByName.set(r[iName], r[iCode]);
  }
  return { byCode, codeByName };
}

async function buildAirports(countries) {
  const airportsCsv = await fetchText(
    'https://davidmegginson.github.io/ourairports-data/airports.csv',
  );
  const rows = parseCsv(airportsCsv);
  const head = rows[0];
  const col = (name) => head.indexOf(name);
  const iIdent = col('ident');
  const iType = col('type');
  const iName = col('name');
  const iLat = col('latitude_deg');
  const iLon = col('longitude_deg');
  const iCountry = col('iso_country');
  const iCity = col('municipality');
  const iSched = col('scheduled_service');
  const iIata = col('iata_code');

  const airports = [];
  for (const row of rows.slice(1)) {
    if (row[iType] !== 'large_airport' && row[iType] !== 'medium_airport') continue;
    if (row[iSched] !== 'yes' || !row[iIata]) continue;
    airports.push({
      icao: row[iIdent],
      iata: row[iIata],
      name: row[iName],
      city: row[iCity] || '',
      country: countries.byCode.get(row[iCountry]) ?? row[iCountry],
      countryCode: row[iCountry] || '',
      lat: Number(row[iLat]),
      lon: Number(row[iLon]),
    });
  }
  return airports;
}

// Alliance membership by ICAO code (curated, roughly as of 2025). Used for
// "right alliance" feedback in Fill-the-Flight.
const ALLIANCES = new Map(
  Object.entries({
    // Star Alliance
    ACA: 'star', CCA: 'star', AIC: 'star', ANZ: 'star', ANA: 'star', AAR: 'star', AUA: 'star',
    AVA: 'star', BEL: 'star', CMP: 'star', CTN: 'star', MSR: 'star', ETH: 'star', EVA: 'star',
    LOT: 'star', DLH: 'star', CSZ: 'star', SIA: 'star', SAA: 'star', SWR: 'star', TAP: 'star',
    THA: 'star', THY: 'star', UAL: 'star',
    // oneworld
    AAL: 'oneworld', ASA: 'oneworld', BAW: 'oneworld', CPA: 'oneworld', FIN: 'oneworld',
    IBE: 'oneworld', JAL: 'oneworld', MAS: 'oneworld', QFA: 'oneworld', QTR: 'oneworld',
    RAM: 'oneworld', RJA: 'oneworld', ALK: 'oneworld', OMA: 'oneworld',
    // SkyTeam
    ARG: 'skyteam', AMX: 'skyteam', AEA: 'skyteam', AFR: 'skyteam', CAL: 'skyteam',
    CES: 'skyteam', DAL: 'skyteam', GIA: 'skyteam', ITY: 'skyteam', KQA: 'skyteam',
    KLM: 'skyteam', KAL: 'skyteam', MEA: 'skyteam', SVA: 'skyteam', ROT: 'skyteam',
    HVN: 'skyteam', VIR: 'skyteam', CXA: 'skyteam', SAS: 'skyteam',
  }),
);

// Airlines missing from (or newer than) the OpenFlights dump.
const AIRLINE_TOPUPS = [
  { icao: 'ITY', iata: 'AZ', name: 'ITA Airways', callsign: 'ITARROW', country: 'Italy', countryCode: 'IT' },
  { icao: 'MXY', iata: 'MX', name: 'Breeze Airways', callsign: 'MOXY', country: 'United States', countryCode: 'US' },
  { icao: 'NBT', iata: 'N0', name: 'Norse Atlantic Airways', callsign: 'LONGSHIP', country: 'Norway', countryCode: 'NO' },
  { icao: 'SJX', iata: 'JX', name: 'Starlux Airlines', callsign: 'STARWALKER', country: 'Taiwan', countryCode: 'TW' },
  { icao: 'EJU', iata: 'EC', name: 'easyJet Europe', callsign: 'ALPINE', country: 'Austria', countryCode: 'AT' },
  { icao: 'EJH', iata: 'DS', name: 'easyJet Switzerland', callsign: 'TOPSWISS', country: 'Switzerland', countryCode: 'CH' },
  { icao: 'WUK', iata: 'W9', name: 'Wizz Air UK', callsign: 'WIZZ GO', country: 'United Kingdom', countryCode: 'GB' },
  { icao: 'WMT', iata: 'W4', name: 'Wizz Air Malta', callsign: 'WIZZ MALTA', country: 'Malta', countryCode: 'MT' },
  { icao: 'WAZ', iata: '5W', name: 'Wizz Air Abu Dhabi', callsign: 'WIZZ SKY', country: 'United Arab Emirates', countryCode: 'AE' },
  { icao: 'RUK', iata: 'RK', name: 'Ryanair UK', callsign: 'BLUE MAX', country: 'United Kingdom', countryCode: 'GB' },
  { icao: 'RYS', iata: 'RR', name: 'Buzz (Ryanair)', callsign: 'MAGIC SUN', country: 'Poland', countryCode: 'PL' },
  { icao: 'MAY', iata: 'AM', name: 'Malta Air (Ryanair)', callsign: 'MALTA AIR', country: 'Malta', countryCode: 'MT' },
  { icao: 'EDV', iata: '9E', name: 'Endeavor Air', callsign: 'ENDEAVOR', country: 'United States', countryCode: 'US' },
  { icao: 'RPA', iata: 'YX', name: 'Republic Airways', callsign: 'BRICKYARD', country: 'United States', countryCode: 'US' },
  { icao: 'ENY', iata: 'MQ', name: 'Envoy Air', callsign: 'ENVOY', country: 'United States', countryCode: 'US' },
  { icao: 'JIA', iata: 'OH', name: 'PSA Airlines', callsign: 'BLUE STREAK', country: 'United States', countryCode: 'US' },
  { icao: 'GJS', iata: 'G7', name: 'GoJet Airlines', callsign: 'LINDBERGH', country: 'United States', countryCode: 'US' },
  { icao: 'AWI', iata: 'ZW', name: 'Air Wisconsin', callsign: 'WISCONSIN', country: 'United States', countryCode: 'US' },
  { icao: 'FFT', iata: 'F9', name: 'Frontier Airlines', callsign: 'FRONTIER FLIGHT', country: 'United States', countryCode: 'US' },
  { icao: 'VOI', iata: 'Y4', name: 'Volaris', callsign: 'VOLARIS', country: 'Mexico', countryCode: 'MX' },
  // Regional operators that get brand-merged into their mainline partners.
  { icao: 'HOP', iata: 'A5', name: 'Air France HOP', callsign: 'AIR HOP', country: 'France', countryCode: 'FR' },
  { icao: 'AKX', iata: 'EH', name: 'ANA Wings', callsign: 'ALFA WING', country: 'Japan', countryCode: 'JP' },
  { icao: 'JLJ', iata: 'XM', name: 'J-Air', callsign: 'J AIR', country: 'Japan', countryCode: 'JP' },
  { icao: 'SSQ', iata: '', name: 'Sunstate Airlines (QantasLink)', callsign: 'SUNSTATE', country: 'Australia', countryCode: 'AU' },
  { icao: 'EAI', iata: 'EA', name: 'Emerald Airlines (Aer Lingus Regional)', callsign: 'GAELFORCE', country: 'Ireland', countryCode: 'IE' },
  // Airlines founded after the OpenFlights dump froze (~2016).
  { icao: 'AKJ', iata: 'QP', name: 'Akasa Air', callsign: 'AKASA AIR', country: 'India', countryCode: 'IN' },
  { icao: 'BAV', iata: 'QH', name: 'Bamboo Airways', callsign: 'BAMBOO', country: 'Vietnam', countryCode: 'VN' },
  { icao: 'TZP', iata: 'ZG', name: 'ZIPAIR Tokyo', callsign: 'ZIPPY', country: 'Japan', countryCode: 'JP' },
  { icao: 'APZ', iata: 'YP', name: 'Air Premia', callsign: 'AIR PREMIA', country: 'South Korea', countryCode: 'KR' },
  { icao: 'EOK', iata: 'RF', name: 'Aero K', callsign: 'AERO K', country: 'South Korea', countryCode: 'KR' },
  { icao: 'HGB', iata: 'HB', name: 'Greater Bay Airlines', callsign: 'GREATER BAY', country: 'Hong Kong', countryCode: 'HK' },
  { icao: 'VXP', iata: 'XP', name: 'Avelo Airlines', callsign: 'AVELO', country: 'United States', countryCode: 'US' },
  { icao: 'FLE', iata: 'F8', name: 'Flair Airlines', callsign: 'FLAIR', country: 'Canada', countryCode: 'CA' },
  { icao: 'ARJ', iata: 'DM', name: 'Arajet', callsign: 'ARAJET', country: 'Dominican Republic', countryCode: 'DO' },
  { icao: 'JAT', iata: 'JA', name: 'JetSMART', callsign: 'ROCKSMART', country: 'Chile', countryCode: 'CL' },
  { icao: 'OCN', iata: '4Y', name: 'Discover Airlines', callsign: 'OCEAN', country: 'Germany', countryCode: 'DE' },
  { icao: 'MBU', iata: 'DI', name: 'Marabu', callsign: 'MARABU', country: 'Estonia', countryCode: 'EE' },
  { icao: 'FBU', iata: 'BF', name: 'French Bee', callsign: 'FRENCH BEE', country: 'France', countryCode: 'FR' },
  { icao: 'FAD', iata: 'F3', name: 'flyadeal', callsign: 'ADEAL', country: 'Saudi Arabia', countryCode: 'SA' },
  { icao: 'RXI', iata: 'RX', name: 'Riyadh Air', callsign: 'RIYADH AIR', country: 'Saudi Arabia', countryCode: 'SA' },
  { icao: 'OMS', iata: 'OV', name: 'SalamAir', callsign: 'MAZOON', country: 'Oman', countryCode: 'OM' },
  { icao: 'APK', iata: 'P4', name: 'Air Peace', callsign: 'PEACE BIRD', country: 'Nigeria', countryCode: 'NG' },
  { icao: 'SJV', iata: 'IU', name: 'Super Air Jet', callsign: 'SUPER GREEN', country: 'Indonesia', countryCode: 'ID' },
  { icao: 'WFL', iata: '2W', name: 'World2Fly', callsign: 'WORLD CLASS', country: 'Spain', countryCode: 'ES' },
  { icao: 'EVE', iata: 'E9', name: 'Iberojet', callsign: 'EVELOP', country: 'Spain', countryCode: 'ES' },
];

// Rebrands and renames since the OpenFlights dump froze: keep the ICAO,
// update the searchable name (and country where ownership actually moved).
const AIRLINE_RENAMES = new Map(
  Object.entries({
    TVS: { name: 'Smartwings (Travel Service)' },
    TAM: { name: 'LATAM Airlines Brasil' },
    LAN: { name: 'LATAM Airlines Chile' },
    LPE: { name: 'LATAM Airlines Perú' },
    KNE: { name: 'flynas' },
    SFR: { name: 'FlySafair' },
    MXD: { name: 'Batik Air Malaysia' },
    RPB: { name: 'Wingo' },
    GLO: { name: 'GOL Linhas Aéreas' },
    SLI: { name: 'Aeroméxico Connect' },
    IGO: { name: 'IndiGo' },
    UBD: { name: 'UR Airlines', country: 'Iraq', countryCode: 'IQ' },
  }),
);

async function buildAirlines(countries) {
  const text = await fetchText(
    'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat',
  );
  const airlines = new Map();
  for (const row of parseCsv(text)) {
    // Airline ID, Name, Alias, IATA, ICAO, Callsign, Country, Active
    const [, name, , iata, icao, callsign, country, active] = row;
    if (active !== 'Y') continue;
    if (!icao || icao === '\\N' || !/^[A-Z0-9]{3}$/.test(icao)) continue;
    if (!name || name === 'Unknown' || name === 'Private flight') continue;
    if (airlines.has(icao)) continue;
    const countryName = country && country !== '\\N' ? country : '';
    airlines.set(icao, {
      icao,
      iata: iata && iata !== '\\N' && iata !== '-' ? iata : '',
      name,
      callsign: callsign && callsign !== '\\N' ? callsign : '',
      country: countryName,
      countryCode: countries.codeByName.get(countryName) ?? '',
      alliance: ALLIANCES.get(icao) ?? '',
    });
  }
  for (const a of AIRLINE_TOPUPS) {
    airlines.set(a.icao, { ...a, alliance: ALLIANCES.get(a.icao) ?? '' });
  }
  for (const [icao, patch] of AIRLINE_RENAMES) {
    const existing = airlines.get(icao);
    if (existing) airlines.set(icao, { ...existing, ...patch });
  }
  return [...airlines.values()];
}

// Curated ICAO type designators: common airliner types a player could plausibly
// guess. The flight picker only accepts flights whose designator is listed
// here, which doubles as the "is this an airliner?" filter.
const NB = 'narrow-body jet';
const WB = 'wide-body jet';
const RJ = 'regional jet';
const TP = 'turboprop';
const t = (icao, name, manufacturer, family, cls) => ({ icao, name, manufacturer, family, class: cls });
const AIRCRAFT_TYPES = [
  // Airbus narrow-bodies
  t('A318', 'Airbus A318', 'Airbus', 'Airbus A320', NB),
  t('A319', 'Airbus A319', 'Airbus', 'Airbus A320', NB),
  t('A19N', 'Airbus A319neo', 'Airbus', 'Airbus A320', NB),
  t('A320', 'Airbus A320', 'Airbus', 'Airbus A320', NB),
  t('A20N', 'Airbus A320neo', 'Airbus', 'Airbus A320', NB),
  t('A321', 'Airbus A321', 'Airbus', 'Airbus A320', NB),
  t('A21N', 'Airbus A321neo', 'Airbus', 'Airbus A320', NB),
  t('BCS1', 'Airbus A220-100', 'Airbus', 'Airbus A220', NB),
  t('BCS3', 'Airbus A220-300', 'Airbus', 'Airbus A220', NB),
  // Airbus wide-bodies
  t('A306', 'Airbus A300-600', 'Airbus', 'Airbus A300', WB),
  t('A310', 'Airbus A310', 'Airbus', 'Airbus A310', WB),
  t('A332', 'Airbus A330-200', 'Airbus', 'Airbus A330', WB),
  t('A333', 'Airbus A330-300', 'Airbus', 'Airbus A330', WB),
  t('A338', 'Airbus A330-800neo', 'Airbus', 'Airbus A330', WB),
  t('A339', 'Airbus A330-900neo', 'Airbus', 'Airbus A330', WB),
  t('A342', 'Airbus A340-200', 'Airbus', 'Airbus A340', WB),
  t('A343', 'Airbus A340-300', 'Airbus', 'Airbus A340', WB),
  t('A345', 'Airbus A340-500', 'Airbus', 'Airbus A340', WB),
  t('A346', 'Airbus A340-600', 'Airbus', 'Airbus A340', WB),
  t('A359', 'Airbus A350-900', 'Airbus', 'Airbus A350', WB),
  t('A35K', 'Airbus A350-1000', 'Airbus', 'Airbus A350', WB),
  t('A388', 'Airbus A380-800', 'Airbus', 'Airbus A380', WB),
  // Boeing narrow-bodies
  t('B712', 'Boeing 717-200', 'Boeing', 'Boeing 717', NB),
  t('B733', 'Boeing 737-300', 'Boeing', 'Boeing 737', NB),
  t('B734', 'Boeing 737-400', 'Boeing', 'Boeing 737', NB),
  t('B735', 'Boeing 737-500', 'Boeing', 'Boeing 737', NB),
  t('B736', 'Boeing 737-600', 'Boeing', 'Boeing 737', NB),
  t('B737', 'Boeing 737-700', 'Boeing', 'Boeing 737', NB),
  t('B738', 'Boeing 737-800', 'Boeing', 'Boeing 737', NB),
  t('B739', 'Boeing 737-900', 'Boeing', 'Boeing 737', NB),
  t('B37M', 'Boeing 737 MAX 7', 'Boeing', 'Boeing 737', NB),
  t('B38M', 'Boeing 737 MAX 8', 'Boeing', 'Boeing 737', NB),
  t('B39M', 'Boeing 737 MAX 9', 'Boeing', 'Boeing 737', NB),
  t('B3XM', 'Boeing 737 MAX 10', 'Boeing', 'Boeing 737', NB),
  t('B752', 'Boeing 757-200', 'Boeing', 'Boeing 757', NB),
  t('B753', 'Boeing 757-300', 'Boeing', 'Boeing 757', NB),
  // Boeing wide-bodies
  t('B742', 'Boeing 747-200', 'Boeing', 'Boeing 747', WB),
  t('B744', 'Boeing 747-400', 'Boeing', 'Boeing 747', WB),
  t('B748', 'Boeing 747-8', 'Boeing', 'Boeing 747', WB),
  t('B762', 'Boeing 767-200', 'Boeing', 'Boeing 767', WB),
  t('B763', 'Boeing 767-300', 'Boeing', 'Boeing 767', WB),
  t('B764', 'Boeing 767-400', 'Boeing', 'Boeing 767', WB),
  t('B772', 'Boeing 777-200', 'Boeing', 'Boeing 777', WB),
  t('B77L', 'Boeing 777-200LR/F', 'Boeing', 'Boeing 777', WB),
  t('B773', 'Boeing 777-300', 'Boeing', 'Boeing 777', WB),
  t('B77W', 'Boeing 777-300ER', 'Boeing', 'Boeing 777', WB),
  t('B778', 'Boeing 777-8', 'Boeing', 'Boeing 777', WB),
  t('B779', 'Boeing 777-9', 'Boeing', 'Boeing 777', WB),
  t('B788', 'Boeing 787-8', 'Boeing', 'Boeing 787', WB),
  t('B789', 'Boeing 787-9', 'Boeing', 'Boeing 787', WB),
  t('B78X', 'Boeing 787-10', 'Boeing', 'Boeing 787', WB),
  t('MD11', 'McDonnell Douglas MD-11', 'McDonnell Douglas', 'MD-11', WB),
  // Embraer
  t('E135', 'Embraer ERJ-135', 'Embraer', 'Embraer ERJ', RJ),
  t('E145', 'Embraer ERJ-145', 'Embraer', 'Embraer ERJ', RJ),
  t('E170', 'Embraer E170', 'Embraer', 'Embraer E-Jet', RJ),
  t('E75S', 'Embraer E175', 'Embraer', 'Embraer E-Jet', RJ),
  t('E75L', 'Embraer E175', 'Embraer', 'Embraer E-Jet', RJ),
  t('E190', 'Embraer E190', 'Embraer', 'Embraer E-Jet', RJ),
  t('E195', 'Embraer E195', 'Embraer', 'Embraer E-Jet', RJ),
  t('E275', 'Embraer E175-E2', 'Embraer', 'Embraer E-Jet', RJ),
  t('E290', 'Embraer E190-E2', 'Embraer', 'Embraer E-Jet', RJ),
  t('E295', 'Embraer E195-E2', 'Embraer', 'Embraer E-Jet', RJ),
  // Bombardier / De Havilland
  t('CRJ2', 'Bombardier CRJ200', 'Bombardier', 'Bombardier CRJ', RJ),
  t('CRJ7', 'Bombardier CRJ700', 'Bombardier', 'Bombardier CRJ', RJ),
  t('CRJ9', 'Bombardier CRJ900', 'Bombardier', 'Bombardier CRJ', RJ),
  t('CRJX', 'Bombardier CRJ1000', 'Bombardier', 'Bombardier CRJ', RJ),
  t('DH8A', 'De Havilland Dash 8-100', 'De Havilland Canada', 'Dash 8', TP),
  t('DH8C', 'De Havilland Dash 8-300', 'De Havilland Canada', 'Dash 8', TP),
  t('DH8D', 'De Havilland Dash 8 Q400', 'De Havilland Canada', 'Dash 8', TP),
  // ATR
  t('AT43', 'ATR 42-300', 'ATR', 'ATR 42', TP),
  t('AT45', 'ATR 42-500', 'ATR', 'ATR 42', TP),
  t('AT46', 'ATR 42-600', 'ATR', 'ATR 42', TP),
  t('AT72', 'ATR 72-200', 'ATR', 'ATR 72', TP),
  t('AT75', 'ATR 72-500', 'ATR', 'ATR 72', TP),
  t('AT76', 'ATR 72-600', 'ATR', 'ATR 72', TP),
  // Others
  t('SU95', 'Sukhoi Superjet 100', 'Sukhoi', 'Superjet', RJ),
  t('C919', 'COMAC C919', 'COMAC', 'COMAC C919', NB),
  t('AJ27', 'COMAC ARJ21', 'COMAC', 'COMAC ARJ21', RJ),
  t('F70', 'Fokker 70', 'Fokker', 'Fokker 70/100', RJ),
  t('F100', 'Fokker 100', 'Fokker', 'Fokker 70/100', RJ),
  t('SF34', 'Saab 340', 'Saab', 'Saab 340', TP),
  t('A124', 'Antonov An-124', 'Antonov', 'Antonov An-124', WB),
];

const countries = await fetchCountries();
const [airports, airlines] = await Promise.all([
  buildAirports(countries),
  buildAirlines(countries),
]);
await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, 'airports.json'), JSON.stringify(airports));
await writeFile(path.join(OUT_DIR, 'airlines.json'), JSON.stringify(airlines));
await writeFile(path.join(OUT_DIR, 'aircraft-types.json'), JSON.stringify(AIRCRAFT_TYPES));
console.log(
  `Wrote ${airports.length} airports, ${airlines.length} airlines, ${AIRCRAFT_TYPES.length} aircraft types to ${OUT_DIR}`,
);
