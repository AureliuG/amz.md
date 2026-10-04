# Nobil Prest · Depozit & livrări

A warehouse and delivery dashboard (UI in Romanian) for institutional food supply (kindergartens, schools,
hospitals, penitentiaries, social care) across Moldova. It has two views:

- **Warehouse (3D):** the main warehouse with the front entrance and 6 docks, the rarely used back
  entrance, the office, dry goods racks, the cold room and the underground vegetable & fruit depot.
  Trucks load at the docks, forklifts shuttle pallets, and trucks leave and return through the main gate.
  Use 👁 to look inside.
- **Moldova:** numbered trucks (Mașina 1–12, more can be added from the Mașini tab), about 800 institutions,
  live truck positions and delivery status (due by 18:00).

- **Livrări:** every delivery of the day in one table, with search, status/truck filters and sorting.
- **Activitate (🔔):** a live feed of loadings, departures, arrivals and deliveries.
- **Program:** the day as a timeline, one row per truck (loading, driving, unloading, return) with a "now" line.
- **Shortcuts:** 1–4 switch pages, space plays/pauses, Esc closes details. The 3D light follows the time of day.
- **Time slider** in the top bar to scrub through the day; Esc closes the detail panel.

Everything currently runs on **generated demo data** and a simulated clock (play/pause and speed
controls in the top bar). See [`docs/PLAN.md`](docs/PLAN.md) for the roadmap: 1C import,
real road routing, and a driver app with GPS.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Code map

| Path | What |
|---|---|
| `src/lib/seed.ts` | Demo data: institutions, products/stock, `buildFleet(n)` for today's routes, warehouse location. Replaced by the 1C import later. |
| `src/lib/events.ts` | The day's activity feed, derived from the plan and the clock. |
| `src/lib/sim.ts` | Derives truck/stop status from the plan and the clock (pure functions). |
| `src/lib/store.ts` | UI state (view, clock, selection) and the fleet (size saved in the browser). |
| `src/components/scene/` | React Three Fiber warehouse scene and low-poly models. |
| `src/components/map/` | MapLibre map of Moldova (works offline; adds OpenStreetMap roads when reachable). |
| `src/components/hud/` | Top bar, KPI cards, detail panel, tracking and fleet panels. |
