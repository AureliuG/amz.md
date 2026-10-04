# DepotOps

A warehouse and delivery dashboard for institutional food supply (kindergartens, schools,
hospitals, penitentiaries, social care) across Moldova. It has two views:

- **Warehouse (3D):** the main warehouse with the front entrance and 6 docks, the rarely used back
  entrance, the office, dry goods racks, the cold room and the underground vegetable & fruit depot.
  Trucks load at the docks, forklifts shuttle pallets, and trucks leave and return through the main gate.
  Use 👁 to look inside.
- **Moldova:** 12 truck routes, about 800 institutions, live truck positions and delivery status.

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
| `src/lib/seed.ts` | Demo data: institutions, products/stock, trucks, today's routes. Replaced by the 1C import later. |
| `src/lib/sim.ts` | Derives truck/stop status from the plan and the clock (pure functions). |
| `src/lib/store.ts` | UI state (view, clock, selection). |
| `src/components/scene/` | React Three Fiber warehouse scene and low-poly models. |
| `src/components/map/` | MapLibre map of Moldova (works offline; adds OpenStreetMap roads when reachable). |
| `src/components/hud/` | Top bar, KPI cards, detail panel, tracking and fleet panels. |
