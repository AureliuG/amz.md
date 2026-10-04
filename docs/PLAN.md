# Delivery Ops Platform: plan

Goal: a dispatcher dashboard that looks and feels like a strategy game, similar to the
"WareTrack" demo (React + React Three Fiber), connected to a live map of Moldova that
plans and tracks real deliveries.

## 0. What we know about the business (Oct 2026)

- We supply food and ingredients to **institutions**: kindergartens (most of them), schools, hospitals,
  penitentiaries and social care. About **800 institutions** across Moldova.
- **One big warehouse** with two entrances. The **front entrance** is the one we use and the back one is rarely used.
  There's a small **office** inside, and an **underground depot** for vegetables (carrots, potatoes, …) and fruit.
- About **12 trucks** (to confirm) deliver every weekday, each to its own part of Moldova.
- Orders come **by phone** and are entered in **1C**. Delivery is 1–3 days after the order.
  There are no pickups, no cash on delivery and no returns.
- Drivers mostly use Android phones, and several use iPhones.
- Stock is kept in the warehouse. First users: our own team, as an internal dashboard.
- Company: **Nobil Prest**. The interface language is **Romanian**.
- Trucks are identified by **number (Mașina 1–12)**, and more can be added. Models, plates and capacities will come later.
- Some routes are **fixed**, others are **planned fresh each day** (details to come).
- No delivery time windows: deliveries are due **by 18:00** on the delivery day.
- No signatures. Each delivery comes with an **invoice (factură)** from 1C, so the driver app only needs
  "delivered" plus an optional photo of the stamped invoice.

**Status:** a clickable demo (phases 1 + 2 visuals + 4) with generated data is in `src/`.

## 1. What the reference demo actually is

Looking at the video frame by frame, the demo has three parts:

| Layer | What you see | How it's built |
|---|---|---|
| **3D scene** | Isometric, low‑poly, pastel blue/white world: warehouses, docks, trucks, forklifts, pallets, trees, map pins. Click any object to select it (blue outline and label). | React Three Fiber (three.js), orthographic/isometric camera, simple GLB models, soft shadows. |
| **HUD overlay** | Top bar (site switcher WH‑01…WH‑05, "Live" clock, user), KPI cards (stock on hand, trucks on site, on‑time %), zoom/rotate buttons. | Ordinary React and Tailwind components floating over the canvas. |
| **Panels** | Right: detail card for the selected object (forklift battery, pallet lot, truck ETA, site inventory). Bottom left: shipment timeline (Confirmed → Picked → Loaded → In transit → Delivered). Bottom right: tabs for Docks, Forklifts and Trucks. | React components bound to one shared state store. |

The demo runs on **simulated data**. The "alive" feeling comes from a simulation loop that
moves trucks and changes statuses. For us the same visuals have to be driven by real
events: orders, driver GPS and warehouse scans.

## 2. What we build: two zoom levels in one app

```
 ┌───────────────────────── Country view (Moldova) ─────────────────────────┐
 │  Tilted 3D map, styled in the same pastel palette                        │
 │  • warehouses / hubs as 3D icons     • trucks moving live on real roads  │
 │  • planned routes as animated lines  • delivery stops with status pins   │
 │  click a hub ──► fly‑in transition ──► Site view                         │
 └──────────────────────────────────────────────────────────────────────────┘
 ┌──────────────────────────── Site view (warehouse) ───────────────────────┐
 │  Isometric R3F scene like the demo: docks, trucks at bays, pallets,      │
 │  loading progress, which orders are being picked for which route         │
 └──────────────────────────────────────────────────────────────────────────┘
 + Driver mobile app (PWA): route, navigation hand‑off, GPS, proof of delivery
```

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Web app | **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** | Same approach the demo author recommends; modular, and lazy loading comes with the framework. |
| 3D site scene | **React Three Fiber + drei**, loaded with `dynamic(..., { ssr:false })` | R3F can't server‑render, so the UI shell renders on the server and the canvas loads on the client only. |
| Country map | **MapLibre GL JS** with OpenStreetMap vector tiles (OpenFreeMap or MapTiler), custom pastel style, 3D pitch | Free, no Google lock‑in, fully restylable to match the game look. |
| Live layers on map | **deck.gl** (`TripsLayer` for moving trucks, `IconLayer`/`ScenegraphLayer` for 3D truck models) | Smooth animation of hundreds of vehicles. |
| Road routing | **OSRM** (or Valhalla) self‑hosted with the Geofabrik `moldova-latest.osm.pbf` extract (~50 MB) | Real drive times and road geometry inside Moldova, at no per‑request cost. |
| Route optimization | **VROOM** (works with OSRM) | Multi‑vehicle routing with capacities, time windows and driver shifts. Assigns stops to trucks. |
| Geocoding | Photon/Nominatim and a **pin‑drop fallback** | Moldovan addresses (villages, "str." without numbers) often fail to geocode, so the dispatcher or customer can confirm a pin. |
| DB | **Postgres + PostGIS** (Supabase or self‑hosted) | Geo queries such as stops within a zone or nearest hub. |
| Realtime | Supabase Realtime or Socket.io | Driver GPS and status changes are pushed to every dashboard. |
| State | Zustand (UI selection, camera) + TanStack Query (server data) | One "selected object" store shared by the map, 3D scene and panels, as in the demo. |
| Driver app | **PWA** first (Next.js), Expo/React Native later if background GPS needs it | Background GPS is unreliable on a PWA under iOS, so this is the main reason we might go native. |
| Customer notifications | SMS + **Viber** Business messages | Viber is the main messenger in Moldova. |
| 3D models | Low‑poly GLB (Kenney/Quaternius CC0 packs, custom‑made in Blender, or AI‑generated) in our brand colors | Same toy‑like look; trucks branded with our logo. |
| i18n | Romanian + Russian (+ English), MDL, `Europe/Chisinau` | |

## 4. Core data model (first draft)

- `sites` (hubs/warehouses: location, docks, capacity)
- `docks` (site, status, current vehicle)
- `vehicles` (plate, type, capacity kg/m³/pallets, home site), `drivers`
- `customers`, `addresses` (geocoded point, confidence, notes like "gate code", "call first")
- `orders` → `order_items` (weight, volume, COD amount)
- `routes` (date, vehicle, driver, status, OSRM geometry) → `stops` (order, sequence, time window, ETA, status)
- `events` (append‑only log: order_confirmed, picked, loaded, departed, arrived, delivered, failed, plus who/when/where). **Everything on screen is derived from this log.** The shipment timeline in the demo is exactly this.
- `positions` (vehicle, ts, lat/lng, speed) as a time series
- `proofs` (photo, signature, COD collected)
- Optional, if we want the warehouse detail of the demo: `inventory`, `pallets`, `forklifts`

## 5. Delivery flow

1. **Orders come in**: imported from the shop/ERP (API, CSV, 1C export) or entered by hand.
2. **Geocode**: auto, and low‑confidence addresses get flagged for pin confirmation.
3. **Plan**: the dispatcher clicks "Plan tomorrow" and VROOM assigns stops to trucks with
   capacities and time windows. Routes are drawn on the Moldova map and can be edited by drag & drop.
4. **Load**: in the site view, trucks sit at docks and show "Loading 3/8"; warehouse staff
   scan or tick items.
5. **Drive**: the driver app shows the stop list and opens Waze/Google Maps for navigation.
   GPS streams to the server every 5–10 s and the truck moves on the map. ETAs are recalculated live.
6. **Deliver**: the driver records a photo, signature and COD amount, or marks the stop failed with a reason.
   The customer gets a Viber/SMS "arriving in ~15 min" message and a tracking link.
7. **Analyse**: on‑time %, km per route, failed deliveries by reason, deliveries per region.

## 6. Phases (build business value first, then the "wow")

| Phase | Deliverable | Rough size |
|---|---|---|
| 0. Discovery | Answers to the questions below; sample real data (1 week of orders) | days |
| 1. Foundation | Next.js app, auth/roles, DB schema, seed data, **2D panels** (KPIs, shipment timeline, trucks/docks tables) | 1–2 wks |
| 2. Moldova map + planning | Pastel MapLibre map, hubs, OSRM routing, VROOM auto‑planning, route editing | 2–3 wks |
| 3. Driver app + live tracking | PWA, GPS streaming, proof of delivery, live ETAs, customer notifications | 2–3 wks |
| 4. 3D game layer | R3F site scenes, 3D trucks on the map, fly‑in transition, selection/outline, animations | 2–4 wks |
| 5. Polish | Analytics, replay of a past day ("time slider"), alerts (late, off‑route, idle) | ongoing |

A **clickable demo with simulated data** (phases 1, 2 and 4 visuals with a fake event generator) can come first,
so you can show it before the real integrations exist.

## 7. Risks and honest notes

- **The 3D only adds value if it shows real state.** If nobody records dock/loading events, the warehouse
  scene is decoration. The Moldova map plus live trucks gives value from day one.
- **Address quality in Moldova** is the biggest practical problem for routing. We need pin confirmation and
  saved addresses per customer.
- **Background GPS on iPhone** via PWA is limited. Android drivers are fine, and iOS may need the native (Expo) app.
- **Performance**: low‑poly models, instancing for pallets/trees, and the 3D scene loaded only on demand, so the
  dashboard stays fast on ordinary office PCs and phones.

## 8. Open questions

1. **Warehouse location**: the Google Maps short link can't be opened from the build environment.
   Send the coordinates (long-press the pin in Google Maps and copy the two numbers) or the street address.
2. Per truck: model, plate, capacity (kg/pallets), refrigerated or not, usual driver.
3. Which routes are fixed (truck → weekday → institutions) and which are planned daily.
4. 1C configuration and version, and whether an export of orders, institutions (with addresses) and stock is possible.
5. The list of the ~800 institutions with addresses/coordinates.

## 9. Original discovery questions (answered above where known)

1. What do you deliver (parcels, pallets, furniture, food/cold chain)? Typical weight/volume per order?
2. How many warehouses/hubs, and where (Chișinău only, or also Bălți, Cahul, etc.)?
3. How many vehicles and drivers, and which types and capacities?
4. Orders per day now, and the target?
5. Where do orders come from today (online shop amz.md? 1C? Excel? phone)? Is there an API?
6. Same‑day or next‑day delivery? Do customers choose time windows?
7. Cash on delivery? Returns/pickups as well as deliveries?
8. Who uses the system (dispatcher, warehouse staff, drivers, customers, management), and in which languages?
9. Driver phones: Android, iPhone, or mixed?
10. Do you track stock in the warehouse today (WMS, scanners), or only shipments?
11. Branding: logo, colors, company name to put on the 3D trucks and the UI.
12. Hosting preference (cloud vs. own server in Moldova) and budget for map tiles/SMS.
