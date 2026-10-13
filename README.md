# Nobil Prest · Depozit & livrări — v1.3

> **În limba română:**
> - **Instalare pe server și cum verifică compania aplicația:** [`docs/GHID-INSTALARE.md`](docs/GHID-INSTALARE.md)
> - **Ce conține fiecare versiune și ce urmează:** [`CHANGELOG.md`](CHANGELOG.md)
> - **Ghidul pentru utilizatori** este în aplicație: pagina **Ghid** (tasta 8). Conține primii pași, o zi de lucru, ce este nevoie, versiunea, propuneri și probleme.
>
> Pe găzduirea web existentă (cPanel): `COD=… ./scripts/pachet-gazduire.sh delivery` → încărcați arhiva din `dist/` și dezarhivați-o.
> Pe un server Ubuntu: `sudo ./scripts/instalare-server.sh`

A warehouse and delivery dashboard (UI in Romanian) for institutional food supply (kindergartens, schools,
hospitals, penitentiaries, social care) across Moldova, plus a phone page for drivers.

## Office (dashboard, `/`)

| Page (key) | What |
|---|---|
| **Depozit** (1) | 3D yard: the depot with its single loading ramp, the beci (cellar for vegetables and fruit) next to it, office, cold room, dry racks. Trucks load at the beci, wait, back into the ramp and leave. 👁 looks inside. |
| **Comenzi** (2) | All orders in one place, per delivery day: new order (institution, day, products, "like last time"), edit, move to another day/truck, cancel, invoice number. The day's cycle: orders → routes → loading → delivery → invoices. Test orders on/off. |
| **Trasee** (3) | Routes built from the orders (fixed-route localities, city with small vans, the rest by direction, everyone done by 18:00). Approve, unplanned orders, loading queue beci → ramp with "Încărcată" (takes the goods out of stock), timeline, printed sheets for any day. |
| **Moldova** (4) | Routes and institutions on the map. **Live GPS** shows real positions. |
| **Livrări** (5) | Today's deliveries: search, filters, driver confirmations, **Excel (CSV) export**. |
| **Stoc** (6) | Stock per product vs. what loads today/tomorrow, what's left, what to order. Goods receipts, inventory count, product list, movement history. |
| **Date** (7) | Warehouse location, fleet cards (incl. fixed-route localities), institution import, GPS status, simplified graphics. |
| **Ghid** (8) | Romanian onboarding, daily cycle, requirements, versions/roadmap, suggestions, FAQ. |

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

Orders are registered on the Comenzi page (1C import comes in 1.4); a day with no registered order shows example orders.
Routes are computed in the browser from the orders (`src/lib/planner.ts`), so every computer and the drivers' phones see the same plan.
Stored on the server: orders, saved/approved routes, stock levels and movements, products, the fleet, institutions, warehouse location,
GPS positions, driver confirmations and suggestions.

All of these are stored on the server in `data/` (see [`docs/DEPLOY.md`](docs/DEPLOY.md)).
Integrations: [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md). Roadmap: [`docs/PLAN.md`](docs/PLAN.md).

## Run

On a server (Docker + automatic HTTPS): `sudo ./scripts/instalare-server.sh`. Update: `sudo ./scripts/actualizare.sh`. Backup: `./scripts/backup.sh`.

On ordinary cPanel/PHP web hosting, in a subfolder: `COD=<access code> ./scripts/pachet-gazduire.sh delivery` builds `dist/nobilprest-delivery-v<version>.zip`
(static export + `deploy/gazduire/`: `gate.php` access-code page and file server, `api.php` with the same API as `src/app/api`).
Upload and extract it in the domain folder. Data goes to `nobilprest-date-<folder>` outside the web root.

```bash
npm install
npm run dev                       # http://localhost:3000 (no passwords)
npm run build && npm start        # production; set passwords in .env.local (see .env.example)
node scripts/gps-test-sender.mjs  # fake GPS positions for testing Live GPS
```

## Code map

| Path | What |
|---|---|
| `src/lib/seed.ts` | Demo institutions, products, the real fleet, example orders per day (`demoOrders`). |
| `src/lib/planner.ts` | Orders → routes (fixed towns, sweep balanced by working time, 2-opt) and the beci → ramp loading queue. |
| `src/lib/orders.ts`, `src/lib/stock.ts` | Order stage in the cycle; stock helpers (levels, demand). |
| `src/lib/sim.ts` | Truck/stop status from the plan and the clock; driver confirmations override it. |
| `src/lib/alerts.ts` | Alert rules and today's demand per product. |
| `src/lib/store.ts` | UI state, fleet, shared data loading/saving, live GPS, confirmations. |
| `src/lib/importer.ts` | Excel/CSV import, column recognition, geocoding, Google Maps link parsing. |
| `src/lib/server/` | File storage (`data/`) and GPS intake used by the API routes. |
| `src/app/api/` | `orders`, `plan`, `stock`, `state` (shared data), `gps` (positions), `driver/position` (phone GPS), `events` (confirmations), `feedback` (suggestions), `info` (setup status), `health`. |
| `src/lib/version.ts` | App version, changelog, roadmap and requirements shown in the Ghid page (version number comes from `package.json`). |
| `src/app/sofer/` | Driver phone page. |
| `src/middleware.ts` | Office/driver passwords. |
| `src/lib/base.ts` | Subfolder prefix for the web-hosting build (`api()`, `page()`). |
| `deploy/gazduire/` | PHP version of the API + access-code page for cPanel hosting. |
| `src/components/` | Dashboard pages, 3D scene, map, panels, printed sheets. |
