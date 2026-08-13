# Flight Guesser

Guess the live flight. The server picks a real flight that is in the air right now,
and you deduce its hidden attribute (route, airline, or aircraft type) from
progressively revealed clues. See [DESIGN.md](DESIGN.md) for the full game design.

## Run it

```
npm install
npm run fetch-data   # downloads open airport/airline datasets (one-time)
npm run dev          # starts API (:8787) + web app (:5173)
```

Then open http://localhost:5173.

## Deploy (Fly.io)

The app runs as one always-on Node process (in-memory rooms + WebSockets), with
the built frontend served by the API server. One-time setup:

```
brew install flyctl
fly auth signup          # or: fly auth login
fly launch --no-deploy   # accepts fly.toml; pick an app name + region
fly volumes create data --size 1   # persists the daily flight + leaderboard
fly secrets set PHOTO_CONTACT=you@example.com   # Planespotters API contact
fly deploy
```

Then the game lives at `https://<app-name>.fly.dev`. Later updates are just
`fly deploy`.

## Data sources

- Live positions: [adsb.lol](https://api.adsb.lol) (community ADS-B, free)
- Routes & airlines: [adsbdb.com](https://www.adsbdb.com) (free)
- Airports: [OurAirports](https://ourairports.com/data/) (public domain)
- Airlines: [OpenFlights](https://openflights.org/data.html)
- Aircraft photos on the reveal card: [Planespotters.net](https://www.planespotters.net) (attribution shown in app)
