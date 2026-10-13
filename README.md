# Nobil Prest · Depozit & livrări — v1.2

> **În limba română:**
> - **Instalare pe server și cum verifică compania aplicația:** [`docs/GHID-INSTALARE.md`](docs/GHID-INSTALARE.md)
> - **Ce conține fiecare versiune și ce urmează:** [`CHANGELOG.md`](CHANGELOG.md)
> - **Ghidul pentru utilizatori** este în aplicație: pagina **Ghid** (tasta 6). Conține primii pași, ce este nevoie, versiunea, propuneri și probleme.
>
> Instalare rapidă pe un server Ubuntu: `sudo ./scripts/instalare-server.sh`

A warehouse and delivery dashboard (UI in Romanian) for institutional food supply (kindergartens, schools,
hospitals, penitentiaries, social care) across Moldova, plus a phone page for drivers.

## Office (dashboard, `/`)

| Page (key) | What |
|---|---|
| **Depozit** (1) | 3D warehouse: 6 front docks, rarely used back entrance, office, dry racks, cold room, underground vegetable & fruit depot. Trucks drive in, back into docks, load and leave. 👁 looks inside. Light follows the time of day. |
| **Moldova** (2) | Truck routes and institutions on a map of Moldova. Trails show what was driven. **Live GPS** shows real positions. |
| **Livrări** (3) | Every delivery of the day: search, filters (incl. *Probleme*, *După 18:00*), sorting, driver confirmations, **Excel (CSV) export**. |
| **Program** (4) | The day as a timeline per truck, with a "now" line and the 18:00 deadline. **Print all loading / route sheets.** |
| **Date** (5) | Warehouse location, **fleet cards** (plate, tracker, model, capacity, refrigerated, driver, phone, fixed/daily route, active), institution import from Excel/CSV (1C export), live GPS status, simplified graphics. |
| **Ghid** (6) | Romanian onboarding: setup checklist (checked live against the server), page guide, driver QR code, requirements, version history and roadmap, suggestions & problems (with status), FAQ. |

Also:
- **Alerte (⚠):** deliveries after 18:00, orders that don't fit a truck, chilled products on a non-refrigerated truck, missing GPS, stock that can't cover today, low stock, problems reported by drivers.
- **Activitate (🔔):** loadings, departures, arrivals, deliveries.
- **Printed sheets** per truck: *foaie de încărcare* (picking by storage zone and loading order) and *foaie de parcurs* (stops, invoice/odometer/fuel lines).
- **Acum** jumps to the real time; space plays/pauses; Esc closes details. If the PC has no WebGL, the 3D and map views show a notice and the rest keeps working.

## Drivers (`/sofer`, phones)

Pick the truck once, then see today's stops in order. Each stop has:
- **Maps / Waze** navigation;
- **Sună** to call the institution;
- **Am ajuns / Livrat / Problemă** (with a reason).

Taps made without signal are queued and sent later. **Trimite poziția din telefon** shares GPS for trucks whose tracker doesn't work.

## Data

Orders, routes and stock are still **generated demo data** until 1C is connected. Real today:
- the 16 vehicles (plates and trackers from the GPS client);
- imported institutions;
- the warehouse location;
- GPS positions;
- driver confirmations.

All of these are stored on the server in `data/` (see [`docs/DEPLOY.md`](docs/DEPLOY.md)).
Integrations: [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md). Roadmap: [`docs/PLAN.md`](docs/PLAN.md).

## Run

On a server (Docker + automatic HTTPS): `sudo ./scripts/instalare-server.sh`. Update: `sudo ./scripts/actualizare.sh`. Backup: `./scripts/backup.sh`.

```bash
npm install
npm run dev                       # http://localhost:3000 (no passwords)
npm run build && npm start        # production; set passwords in .env.local (see .env.example)
node scripts/gps-test-sender.mjs  # fake GPS positions for testing Live GPS
```

## Code map

| Path | What |
|---|---|
| `src/lib/seed.ts` | Demo data and the planner: institutions, products/stock, real fleet, `buildFleet(fleetCards)`. |
| `src/lib/sim.ts` | Truck/stop status from the plan and the clock; driver confirmations override it. |
| `src/lib/alerts.ts` | Alert rules and today's demand per product. |
| `src/lib/store.ts` | UI state, fleet, shared data loading/saving, live GPS, confirmations. |
| `src/lib/importer.ts` | Excel/CSV import, column recognition, geocoding, Google Maps link parsing. |
| `src/lib/server/` | File storage (`data/`) and GPS intake used by the API routes. |
| `src/app/api/` | `state` (shared data), `gps` (positions), `driver/position` (phone GPS), `events` (confirmations), `feedback` (suggestions), `info` (setup status), `health`. |
| `src/lib/version.ts` | App version, changelog, roadmap and requirements shown in the Ghid page (version number comes from `package.json`). |
| `src/app/sofer/` | Driver phone page. |
| `src/middleware.ts` | Office/driver passwords. |
| `src/components/` | Dashboard pages, 3D scene, map, panels, printed sheets. |
