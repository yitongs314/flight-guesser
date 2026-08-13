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

## Data sources

- Live positions: [adsb.lol](https://api.adsb.lol) (community ADS-B, free)
- Routes & airlines: [adsbdb.com](https://www.adsbdb.com) (free)
- Airports: [OurAirports](https://ourairports.com/data/) (public domain)
- Airlines: [OpenFlights](https://openflights.org/data.html)
- Aircraft photos on the reveal card: [Planespotters.net](https://www.planespotters.net) (attribution shown in app)
