/**
 * Turns the orders of a day into routes and a loading schedule.
 *
 * 1. Routes: a saved plan (Program page) is used as it is; otherwise the orders are split automatically:
 *    fixed-route vehicles take their localities, Chișinău goes to the smaller vehicles, the rest of the
 *    country is split by direction from the depot (a "sweep"), each vehicle filled up to its capacity.
 *    Stops are ordered by nearest neighbour, then improved with 2-opt.
 * 2. Loading: one truck at the beci (vegetables and fruit) and one at the single ramp of the depot.
 *    Trucks with the longest trips load first; each goes to the beci first (if it carries cellar goods),
 *    then to the ramp, then leaves.
 * 3. Times: driving at ~55 km/h between localities and ~30 km/h in town, plus unloading time per stop.
 */
import { bearingDeg, haversineKm } from "./geo";
import { DELIVER_BY, INSTITUTION_BY_ID, normalize, PRODUCT_BY_ID, truckColor, WAREHOUSE } from "./seed";
import { daysBetween, isoDay } from "./dates";
import type { DayPlan, LngLat, Order, OrderLine, Stop, Truck, TruckInfo } from "./types";

/** First truck starts loading at the beci. */
export const LOAD_START = 5 * 60 + 30;
/** Orders closer than this to the depot are city deliveries (Chișinău). */
const CITY_KM = 14;
/** Fill vehicles up to this share of their capacity. */
const FILL = 0.95;
const MOVE_BECI_TO_RAMP = 4;
const RAMP_GAP = 2;

/** Approximate weight of an order line in kg (litres ≈ kg, a piece ≈ 0.5 kg). */
export function lineKg(l: OrderLine): number {
  const p = PRODUCT_BY_ID.get(l.productId);
  return p?.unit === "pcs" ? l.qty * 0.5 : l.qty;
}
export const orderKg = (o: { lines: OrderLine[] }) => o.lines.reduce((a, l) => a + lineKg(l), 0);
const isCellar = (l: OrderLine) => PRODUCT_BY_ID.get(l.productId)?.zone === "cellar";

/** Minutes of loading at the beci and at the ramp for a set of lines. */
export function loadingMinutes(lines: OrderLine[]) {
  let beciKg = 0;
  let rampKg = 0;
  lines.forEach((l) => (isCellar(l) ? (beciKg += lineKg(l)) : (rampKg += lineKg(l))));
  // A forklift loads roughly 150 kg a minute, plus a few minutes to open up and check the sheet.
  return { beci: beciKg > 0 ? 4 + beciKg / 150 : 0, ramp: rampKg > 0 ? 5 + rampKg / 150 : 3, beciKg, rampKg };
}

interface Item {
  o: Order;
  pos: LngLat;
  kg: number;
  d: number;
  b: number;
  town: string;
}

const dist = (a: LngLat, b: LngLat) => haversineKm(a, b);

/** Nearest neighbour from the depot, then 2-opt on the closed tour depot → stops → depot. */
export function orderStops<T extends { pos: LngLat }>(items: T[]): T[] {
  if (items.length < 3) return [...items].sort((a, b) => dist(WAREHOUSE, a.pos) - dist(WAREHOUSE, b.pos));
  const left = [...items];
  const route: T[] = [];
  let cur: LngLat = WAREHOUSE;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (dist(cur, left[i].pos) < dist(cur, left[best].pos)) best = i;
    const next = left.splice(best, 1)[0];
    route.push(next);
    cur = next.pos;
  }
  const pts = [WAREHOUSE, ...route.map((r) => r.pos), WAREHOUSE];
  let improved = true;
  for (let pass = 0; improved && pass < 30; pass++) {
    improved = false;
    for (let i = 1; i < pts.length - 2; i++) {
      for (let k = i + 1; k < pts.length - 1; k++) {
        const delta = dist(pts[i - 1], pts[k]) + dist(pts[i], pts[k + 1]) - dist(pts[i - 1], pts[i]) - dist(pts[k], pts[k + 1]);
        if (delta < -1e-6) {
          pts.splice(i, k - i + 1, ...pts.slice(i, k + 1).reverse());
          route.splice(i - 1, k - i + 1, ...route.slice(i - 1, k).reverse());
          improved = true;
        }
      }
    }
  }
  return route;
}

/** Cheapest place to insert a point into a route (index in the route). */
function cheapestInsert(route: LngLat[], p: LngLat): { at: number; cost: number } {
  let best = { at: route.length, cost: Infinity };
  for (let i = 0; i <= route.length; i++) {
    const a = i === 0 ? WAREHOUSE : route[i - 1];
    const b = i === route.length ? WAREHOUSE : route[i];
    const cost = dist(a, p) + dist(p, b) - dist(a, b);
    if (cost < best.cost) best = { at: i, cost };
  }
  return best;
}

/** Average speed (km/h) used to estimate a route's duration while splitting. */
const EST_SPEED = 52;
/** Latest working time (minutes from departure to the last delivery) for country and city vehicles. */
const BUDGET = { country: 18 * 60 - (7 * 60 + 15) - 15, city: 18 * 60 - 10 * 60 - 15 };

/**
 * Consecutive groups by direction, one per vehicle, each kept under its capacity and under `maxMin` minutes
 * of work (driving to the last stop + unloading). Returns what did not fit.
 */
function sweepGroups(ring: Item[], vehicles: { number: number; cap: number }[], maxMin: number): { groups: Item[][]; rest: Item[] } {
  const groups: Item[][] = vehicles.map(() => []);
  const rest: Item[] = [];
  let k = 0;
  let tour: LngLat[] = [];
  let km = 0;
  let dwell = 0;
  let load = 0;
  let nearest = Infinity;
  for (const it of ring) {
    if (k >= vehicles.length) {
      rest.push(it);
      continue;
    }
    let ins = cheapestInsert(tour, it.pos);
    const minutes = (nk: number, nd: number, nn: number) => (((nk - nn) * 1.3) / EST_SPEED) * 60 + nd;
    const over = () => load + it.kg > vehicles[k].cap || minutes(km + ins.cost, dwell + 12 + it.kg / 60, Math.min(nearest, it.d)) > maxMin;
    if (groups[k].length && over()) {
      k++;
      tour = [];
      km = 0;
      dwell = 0;
      load = 0;
      nearest = Infinity;
      if (k >= vehicles.length || it.kg > vehicles[k].cap) {
        rest.push(it);
        continue;
      }
      ins = cheapestInsert(tour, it.pos);
    }
    groups[k].push(it);
    tour.splice(ins.at, 0, it.pos);
    km += ins.cost;
    dwell += 12 + it.kg / 60;
    load += it.kg;
    nearest = Math.min(nearest, it.d);
  }
  return { groups, rest };
}

/**
 * Split items around the depot by direction among the vehicles, balancing the working time:
 * the shortest day per vehicle at which everything still fits (never more than `budget`).
 */
function sweep(items: Item[], vehicles: { number: number; cap: number }[], into: Map<number, Item[]>, budget: number): Item[] {
  if (!items.length || !vehicles.length) return items;
  const sorted = [...items].sort((a, b) => a.b - b.b);
  // Start after the widest empty angle, so a group never wraps around a gap.
  let start = 0;
  let gap = -1;
  sorted.forEach((it, i) => {
    const prev = sorted[(i - 1 + sorted.length) % sorted.length];
    const g = (it.b - prev.b + 360) % 360 || 360;
    if (g > gap) {
      gap = g;
      start = i;
    }
  });
  const ring = [...sorted.slice(start), ...sorted.slice(0, start)];
  let best = sweepGroups(ring, vehicles, budget);
  if (!best.rest.length) {
    let lo = 30;
    let hi = budget;
    for (let i = 0; i < 14 && hi - lo > 5; i++) {
      const mid = (lo + hi) / 2;
      const res = sweepGroups(ring, vehicles, mid);
      if (res.rest.length) lo = mid;
      else {
        hi = mid;
        best = res;
      }
    }
  }
  best.groups.forEach((g, k) => into.get(vehicles[k].number)!.push(...g));
  return best.rest;
}

/** Put leftover orders where they add the least distance, if a vehicle still has room. */
function insertLeftovers(rest: Item[], into: Map<number, Item[]>, caps: Map<number, number>): Item[] {
  const unplaced: Item[] = [];
  for (const it of [...rest].sort((a, b) => b.kg - a.kg)) {
    let best: { n: number; at: number; cost: number } | null = null;
    for (const [n, list] of into) {
      const load = list.reduce((a, x) => a + x.kg, 0);
      if (load + it.kg > (caps.get(n) ?? 0)) continue;
      const c = cheapestInsert(list.map((x) => x.pos), it.pos);
      if (!best || c.cost < best.cost) best = { n, ...c };
    }
    if (best) into.get(best.n)!.splice(best.at, 0, it);
    else unplaced.push(it);
  }
  return unplaced;
}

/** Automatic routes for a day. */
export function autoRoutes(orders: Order[], fleet: TruckInfo[]): { routes: DayPlan["routes"]; unplanned: Order[] } {
  const vehicles = fleet.filter((f) => f.active);
  const items: Item[] = orders.flatMap((o) => {
    const inst = INSTITUTION_BY_ID.get(o.institutionId);
    if (!inst) return [];
    return [{ o, pos: inst.pos, kg: orderKg(o), d: dist(WAREHOUSE, inst.pos), b: bearingDeg(WAREHOUSE, inst.pos), town: normalize(inst.town) }];
  });
  const into = new Map<number, Item[]>(vehicles.map((v) => [v.number, []]));
  const caps = new Map(vehicles.map((v) => [v.number, v.capacityKg * FILL]));
  let pool = items;

  // 1. Fixed routes take the localities written on their fleet card.
  const fixed = vehicles.filter((v) => v.routeType === "fix" && v.towns?.trim());
  for (const v of fixed) {
    const towns = v.towns!.split(/[,;]/).map(normalize).filter(Boolean);
    let load = 0;
    pool = pool.filter((it) => {
      if (!towns.some((t) => it.town === t || it.town.includes(t))) return true;
      if (load + it.kg > caps.get(v.number)!) return true;
      into.get(v.number)!.push(it);
      load += it.kg;
      return false;
    });
  }

  // 2. The others: Chișinău with the smaller vehicles, the rest of the country by direction.
  const general = vehicles.filter((v) => !fixed.includes(v));
  const city = pool.filter((it) => it.d < CITY_KM);
  const country = pool.filter((it) => it.d >= CITY_KM);
  const kg = (l: Item[]) => l.reduce((a, x) => a + x.kg, 0);
  let rest: Item[] = [];
  if (general.length) {
    const bySize = [...general].sort((a, b) => a.capacityKg - b.capacityKg || a.number - b.number);
    const avgCap = bySize.reduce((a, v) => a + v.capacityKg, 0) / bySize.length;
    let nCity = city.length ? Math.max(Math.round((general.length * kg(city)) / Math.max(1, kg(pool))), Math.ceil(kg(city) / (avgCap * 0.9)), 1) : 0;
    nCity = Math.min(nCity, country.length ? Math.max(0, general.length - 1) : general.length);
    if (city.length && nCity === 0) nCity = 1;
    const cityV = bySize.slice(0, nCity).map((v) => ({ number: v.number, cap: caps.get(v.number)! }));
    const countryV = bySize
      .slice(nCity)
      .reverse()
      .map((v) => ({ number: v.number, cap: caps.get(v.number)! }));
    rest = [...sweep(city, cityV.length ? cityV : countryV, into, BUDGET.city), ...sweep(country, countryV.length ? countryV : cityV, into, BUDGET.country)];
  } else rest = pool;
  const unplaced = insertLeftovers(rest, into, caps);

  const routes = [...into].map(([truck, list]) => ({ truck, orderIds: orderStops(list).map((x) => x.o.id) }));
  return { routes, unplanned: unplaced.map((x) => x.o) };
}

/** Add orders to existing routes where they fit best (used for orders that arrive after the plan was made). */
export function addToRoutes(routes: DayPlan["routes"], add: Order[], orders: Order[], fleet: TruckInfo[]): { routes: DayPlan["routes"]; unplanned: Order[] } {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const toItem = (o: Order): Item | null => {
    const inst = INSTITUTION_BY_ID.get(o.institutionId);
    return inst ? { o, pos: inst.pos, kg: orderKg(o), d: 0, b: 0, town: "" } : null;
  };
  const active = fleet.filter((f) => f.active);
  const into = new Map<number, Item[]>(active.map((v) => [v.number, []]));
  for (const r of routes) {
    if (!into.has(r.truck)) continue;
    into.set(
      r.truck,
      r.orderIds.flatMap((id) => {
        const o = byId.get(id);
        const it = o ? toItem(o) : null;
        return it ? [it] : [];
      }),
    );
  }
  const caps = new Map(active.map((v) => [v.number, v.capacityKg * FILL]));
  const unplaced = insertLeftovers(add.flatMap((o) => toItem(o) ?? []), into, caps);
  return { routes: [...into].map(([truck, list]) => ({ truck, orderIds: list.map((x) => x.o.id) })), unplanned: unplaced.map((x) => x.o) };
}

const DIRS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-vest", "vest", "nord-vest"];

/** "Chișinău · nord-est" or the two localities with most stops. */
function regionOf(stops: { pos: LngLat; town: string }[]) {
  if (!stops.length) return "Fără livrări";
  const count = new Map<string, number>();
  stops.forEach((s) => count.set(s.town, (count.get(s.town) ?? 0) + 1));
  const towns = [...count].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  if (towns.length === 1 && normalize(towns[0]) === "chisinau") {
    const b = bearingDeg(WAREHOUSE, [stops.reduce((a, s) => a + s.pos[0], 0) / stops.length, stops.reduce((a, s) => a + s.pos[1], 0) / stops.length]);
    return `Chișinău · ${DIRS[Math.round(b / 45) % 8]}`;
  }
  return towns.slice(0, 2).join(", ");
}

export interface DayResult {
  date: string;
  /** Example orders (no real order registered for this day). */
  demo: boolean;
  orders: Order[];
  trucks: Truck[];
  /** Orders that have no vehicle: they don't fit, or arrived after the plan was approved. */
  unplanned: Order[];
  /** The routes in effect (saved or automatic). */
  routes: DayPlan["routes"];
  saved: DayPlan | null;
}

/** Routes and times for a day, from its orders, the fleet and the saved plan (if any). */
export function planDay(date: string, allOrders: Order[], fleet: TruckInfo[], saved: DayPlan | null, demo = false): DayResult {
  const orders = allOrders.filter((o) => o.status !== "anulata" && INSTITUTION_BY_ID.has(o.institutionId));
  const byId = new Map(orders.map((o) => [o.id, o]));
  const active = fleet.filter((f) => f.active).sort((a, b) => a.number - b.number);
  let routes: DayPlan["routes"];
  let unplanned: Order[] = [];
  if (saved) {
    const activeNos = new Set(active.map((f) => f.number));
    const used = new Set<string>();
    routes = saved.routes
      .filter((r) => activeNos.has(r.truck))
      .map((r) => ({ truck: r.truck, orderIds: r.orderIds.filter((id) => byId.has(id) && !used.has(id) && used.add(id)) }));
    const missing = orders.filter((o) => !used.has(o.id));
    if (saved.approved) unplanned = missing;
    else if (missing.length) ({ routes, unplanned } = addToRoutes(routes, missing, orders, fleet));
  } else ({ routes, unplanned } = autoRoutes(orders, active));

  // Stops and travel times per vehicle.
  type Draft = { info: TruckInfo; list: Order[]; trip: number; load: ReturnType<typeof loadingMinutes> };
  const drafts: Draft[] = active.map((info) => {
    const list = (routes.find((r) => r.truck === info.number)?.orderIds ?? []).map((id) => byId.get(id)!).filter(Boolean);
    let from = WAREHOUSE;
    let trip = 0;
    for (const o of list) {
      const p = INSTITUTION_BY_ID.get(o.institutionId)!.pos;
      const km = dist(from, p) * 1.3;
      trip += (km / (km > 25 ? 55 : 30)) * 60 + 12 + orderKg(o) / 60;
      from = p;
    }
    return { info, list, trip, load: loadingMinutes(list.flatMap((o) => o.lines)) };
  });

  // Loading queue: longest trips first; one truck at the beci, one at the ramp.
  const queue = drafts.filter((d) => d.list.length).sort((a, b) => b.trip - a.trip || a.info.number - b.info.number);
  let beciFree = LOAD_START;
  let rampFree = LOAD_START;
  const times = new Map<number, { loadStart: number; beci: Truck["beci"]; ramp: Truck["ramp"]; order: number }>();
  queue.forEach((d, i) => {
    let ready = LOAD_START;
    let beci: Truck["beci"] = null;
    if (d.load.beci > 0) {
      beci = { from: beciFree, to: beciFree + d.load.beci };
      beciFree = beci.to + RAMP_GAP;
      ready = beci.to + MOVE_BECI_TO_RAMP;
    }
    const from = Math.max(rampFree, ready);
    const ramp = { from, to: from + d.load.ramp };
    rampFree = ramp.to + RAMP_GAP;
    times.set(d.info.number, { loadStart: beci?.from ?? ramp.from, beci, ramp, order: i + 1 });
  });

  const trucks: Truck[] = drafts.map(({ info, list }) => {
    const tm = times.get(info.number) ?? { loadStart: 23 * 60, beci: null, ramp: { from: 23 * 60, to: 23 * 60 }, order: 0 };
    const departAt = tm.ramp.to;
    let t = departAt;
    let from: LngLat = WAREHOUSE;
    let total = 0;
    const stops: Stop[] = list.map((o, s) => {
      const inst = INSTITUTION_BY_ID.get(o.institutionId)!;
      const km = dist(from, inst.pos) * 1.3;
      total += km;
      t += (km / (km > 25 ? 55 : 30)) * 60;
      const weightKg = orderKg(o);
      const arriveAt = t;
      t += 12 + weightKg / 60;
      from = inst.pos;
      return {
        id: `S${info.number}-${s + 1}`,
        orderId: o.id,
        orderNo: o.no,
        institutionId: o.institutionId,
        lines: o.lines,
        weightKg: Math.round(weightKg),
        orderedDaysAgo: Math.max(0, daysBetween(isoDay(new Date(o.createdAt)), date)),
        arriveAt,
        leaveAt: t,
        distanceKm: km,
      };
    });
    const backKm = list.length ? dist(from, WAREHOUSE) * 1.3 : 0;
    total += backKm;
    const returnAt = list.length ? t + (backKm / (backKm > 25 ? 55 : 30)) * 60 : departAt;
    return {
      id: `T${info.number}`,
      number: info.number,
      label: `Mașina ${info.number}`,
      plate: info.plate,
      trackerId: info.trackerId,
      gpsOk: info.gpsOk,
      model: info.model,
      refrigerated: info.refrigerated,
      capacityKg: info.capacityKg,
      driver: info.driver,
      phone: info.phone,
      routeType: info.routeType,
      color: truckColor(info.number - 1),
      region: regionOf(list.map((o) => ({ pos: INSTITUTION_BY_ID.get(o.institutionId)!.pos, town: INSTITUTION_BY_ID.get(o.institutionId)!.town }))),
      loadStart: tm.loadStart,
      beci: tm.beci,
      ramp: tm.ramp,
      loadOrder: tm.order,
      departAt,
      returnAt,
      totalKm: Math.round(total),
      stops,
    };
  });

  return { date, demo, orders, trucks, unplanned, routes, saved };
}

/** Kg on a vehicle and whether it is over capacity. */
export const truckLoadKg = (tr: Truck) => tr.stops.reduce((a, s) => a + s.weightKg, 0);
export const lateStops = (tr: Truck) => tr.stops.filter((s) => s.arriveAt > DELIVER_BY);
