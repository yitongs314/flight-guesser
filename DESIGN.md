# Flight Guessing Game — Design

## Concept

A web game where the server picks a real flight that is in the air *right now*,
freezes a snapshot of it, and players deduce its hidden attributes. Single
player, or two players competing live in an online room.

## Game modes

**Classic modes** — one attribute is the secret; clues about everything else are
revealed one per round:

| Mode | You guess | Never revealed |
|---|---|---|
| Route | Departure + arrival pair | Either airport, flight number |
| Departure / Arrival | One endpoint (easier variants) | That endpoint, flight number |
| Airline | Operating airline | Airline, callsign, registration |
| Aircraft type | Exact variant (family = partial credit) | Type, registration, photo |
| Photo | Airline **and** exact type | Everything except the photo tiles |

**Photo mode** — a real photo of the picked aircraft (Planespotters API) is
sliced into a 6×4 grid server-side. The board starts fully masked; each reveal
uncovers one tile (−50 pts in decay scoring, random order fixed at start).
Airline and type are guessed independently and lock in when correct; the flight
is solved when both are locked. Tiles are served as individual server-side
crops, so the full image never reaches the client until resolution. JetPhotos
has no public API (and scraping violates its ToS), so photos come from the
Planespotters API and the reveal card links out to the aircraft's JetPhotos and
Flightradar24 pages by registration.

**Fill-the-Flight** — the inverse. One of the four facts (departure, arrival,
airline, aircraft type) is given free at the start; the player deduces the
other three, each locking green when correct. Feedback on wrong guesses is the
main clue stream:

- **Airports**: great-circle distance plus an 8-way direction arrow toward the
  truth ("LAS — 590 km off ↗").
- **Airline**: country match and alliance match (curated Star Alliance /
  oneworld / SkyTeam membership in the airline dataset).
- **Aircraft type**: family match, else manufacturer match.

Fill's clue shop sells only situational clues (altitude, speed, size, progress,
route length, position maps) — nothing that names the four hidden fields. In
3-strikes scoring, fill grants 5 strikes instead of 3. The enriched feedback
also applies in the other modes (airline/photo modes get country/alliance
hints, all airport guesses get the direction arrow).

## The clue shop and the anti-leak rule

Each classic mode has a curated **clue shop** (~10–12 clues). Every clue's name
and price are visible from the start; its content is hidden until bought.
Players spend their flight's potential score to buy any clue in any order —
vague clues are cheap (altitude 50, speed 50), decisive ones are expensive
(airline name 250, exact position 250, departure airport 250). A purchase is
blocked if it would drop the potential score below the 100-point floor, so you
can never afford the whole shop — choosing is the game. In photo mode the
tiles are the shop: click any tile to buy it for 50.

**Airline intel**: modes where the airline is hidden (airline, photo, fill)
get three purchasable hint slots (75 pts each), drawn per game from that
airline's hint pool. The pool combines 10 hand-curated bilingual trivia hints
(for ~20 frequently-picked majors, in `server/src/airlineHints.ts`) with
data-driven template hints every airline has (radio callsign, alliance, name
shape, IATA initial), so hints rarely repeat across games and no airline comes
up empty. Hints never contain the airline's name.

Hard rules:

- Any clue that equals or trivially decodes the secret is excluded from that
  mode's deck (e.g. registration is a one-search lookup for both type and
  airline).
- The **flight number/callsign and registration are hidden in every mode** until
  the flight is resolved — both are Flightradar24 lookup keys for the whole
  answer.

## Round flow

1. A clue is revealed.
2. Guess window (~45 s in 2P): each player submits one guess or passes, via
   autocomplete pickers backed by airport/airline/type databases.
3. Server responds with correct/wrong plus mode-appropriate feedback. Route
   modes get per-airport distance feedback by default.
4. In 2P, both players' guesses from the round become visible to each other.
5. On resolution: full reveal card — route on the map, airline, type,
   registration, flight number, aircraft photo (planespotters.net, with
   attribution), link to the real flight.

A match is best-of-N flights (default 5), same flights for both players.

## Scoring — selectable per match

- **Points shop** (default): each flight starts at 1000 points; clues cost
  their listed price, wrong guesses −50, floor 100. Failing scores 0.
- **First correct wins** (2P only, Phase 3): sudden death per flight.
- **3 strikes**: clues still cost points; three wrong answers ends the flight
  at 0.

## Localization

The UI is bilingual (English/中文) with an in-header switcher that works
mid-game. The server never renders clue prose: clues travel as structured
`{key, params}` and the client renders them in the active language. Country
names localize via `Intl.DisplayNames` (ISO codes bundled in the datasets);
aircraft names follow Chinese conventions (波音737-800, 空客A350). Airline,
airport, and city names stay in their dataset form. Server errors carry stable
`code`s so the client can localize them.

## Picking a random live flight (free APIs)

1. Sample a random cell from a weighted list of busy airspace regions (with the
   occasional wildcard) and query **adsb.lol** for aircraft near that point.
2. Filter: airborne above ~10,000 ft, real airline callsign, known airliner
   type, moving at cruise-ish speed.
3. Enrich via **adsbdb.com**: callsign → route + airline; the type designator
   comes from the ADS-B message. Airline falls back to the callsign's ICAO
   prefix against the OpenFlights dataset.
   **Brand merging** (`server/src/brands.ts`): regionals and secondary AOCs
   that fly for exactly one brand are re-attributed to it for display, answers,
   and hints (Endeavor→Delta, Envoy/PSA/Piedmont→American, Horizon→Alaska,
   Cityhopper→KLM, easyJet Europe→easyJet, …; guessing the operator still
   counts). Multi-brand operators (SkyWest, Republic, Mesa, Air Wisconsin)
   stay the shown answer, but any of their mainline partners is accepted as
   correct, since the callsign can't reveal which brand a flight flies for.
4. Validate: both airports and the airline must exist in our own datasets (so
   the autocomplete always contains the answer), the route must be geometrically
   consistent with the aircraft's position (guards against stale route data),
   and any flight missing a field is skipped.
5. The winner is **snapshotted** — the game plays off frozen data, so it doesn't
   matter that the real flight keeps moving.

All picking happens **server-side**; the client never receives hidden fields
until resolution, so there's nothing to find in devtools.

## Architecture

- **Frontend**: React + TypeScript (Vite), MapLibre GL with OpenFreeMap tiles,
  hand-rolled CSS (simple dark theme; a FIDS-style skin was tried and rolled
  back by request).
- **Backend**: one Node + TypeScript server (Fastify). Owns flight picking,
  session state (in memory), guess validation, scoring.
- **Bundled static data** (generated by `npm run fetch-data`): OurAirports
  (medium+large scheduled-service airports), OpenFlights airlines + curated
  top-ups, curated ICAO aircraft type designators (~80 guessable airliner
  types).

## Two-player rooms (built)

A room deals both players the identical flight sequence — same flights, same
clue shop (including the same airline-hint draw), same photo board, same
fill-mode given field — via a shared seed source. Each player has a private
economy: own purchases, own guesses, own locks; you see your opponent's
*activity* (score, clues bought, wrong guesses, done/playing) but never what
they learned. Both players resolve, then ready-up to advance together; the
match ends with a win/lose/draw comparison.

Mechanics: create a room (6-char code, no 0/O/1/I) with chosen settings; the
match auto-starts when the second player joins. Each player is backed by a
full server-side game reached through the normal game endpoints with their own
game id; a WebSocket per player pushes room state on every action. Refreshing
resumes via a token in localStorage. Scoring adds a 2P-only **first-correct
wins** race: the first solve force-resolves the opponent's flight at 0.

## Build phases

1. ✅ Core engine + single-player classic modes.
2. ✅ Fill-the-Flight + richer feedback; photo mode; clue shop; i18n; airline
   intel hints.
3. ✅ Online two-player rooms (WebSockets, server-authoritative, room codes).
4. ✅ Daily flight + leaderboard + personal stats. One shared seed per UTC day
   (`server/src/daily.ts`, persisted to `server/data/daily.json` so restarts
   don't reroll the day), mode rotating daily (route→airline→type→photo→fill,
   photo falls back to route if unavailable). Name-based daily leaderboard
   (top 20, honor-system single attempt — replays keep the best score);
   Wordle-style copyable result. Personal stats live in the browser's
   localStorage only. Still open: difficulty filters (region/cargo/GA).
