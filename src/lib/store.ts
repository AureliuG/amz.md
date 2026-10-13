import { create } from "zustand";
import { api } from "./base";
import { addDays, nextWorkday, todayIso } from "./dates";
import { addToRoutes, autoRoutes, planDay, type DayResult } from "./planner";
import { DEFAULT_FLEET, DEFAULT_WAREHOUSE, defaultTruckInfo, demoOrders, INSTITUTION_BY_ID, MAX_TRUCKS, replaceInstitutions, setWarehouse } from "./seed";
import { baseLevels, mergeLines, replaceProducts, type Levels } from "./stock";
import type { Confirmation, DayPlan, Institution, LngLat, Order, OrderLine, Product, Selection, StockMove, Truck, TruckInfo } from "./types";

/** Latest position reported by a GPS tracker or a driver's phone (from /api/gps). */
export interface LivePos {
  lng: number;
  lat: number;
  /** Epoch milliseconds. */
  ts: number;
  speed?: number;
  heading?: number;
  source?: "tracker" | "phone";
}

/* Browser cache: used when the server store is unreachable (e.g. opened as a static demo). */
const KEYS = { institutions: "nobilprest.institutions.v1", warehouse: "nobilprest.warehouse.v1", fleet: "nobilprest.fleet.v1", lowGfx: "nobilprest.lowGfx" };
const cache = {
  save(key: string, value: unknown) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private mode / quota: the server copy is what matters.
    }
  },
  load<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
};

type Shared = { institutions?: Institution[] | null; warehouse?: LngLat | null; fleet?: TruckInfo[] | null };

/** Save to the server (shared by all office computers); fall back to this browser only. */
async function persist(part: Shared): Promise<"server" | "local"> {
  for (const [k, v] of Object.entries(part)) cache.save(KEYS[k as keyof Shared], v);
  try {
    const res = await fetch(api("/api/state"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(part) });
    return res.ok ? "server" : "local";
  } catch {
    return "local";
  }
}

/** JSON from the server, or null when it can't be reached. */
async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(api(path), { cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(api(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) {
      useUi.getState().notify(data?.error ? `Nu s-a salvat: ${data.error}` : "Nu s-a salvat. Verificați internetul și încercați din nou.", "error");
      return null;
    }
    return data;
  } catch {
    useUi.getState().notify("Nu s-a salvat: serverul nu răspunde. Verificați internetul.", "error");
    return null;
  }
}

export type View = "warehouse" | "orders" | "planning" | "map" | "deliveries" | "stock" | "data" | "guide";
export const VIEWS: View[] = ["warehouse", "orders", "planning", "map", "deliveries", "stock", "data", "guide"];

export type NewOrder = Pick<Order, "institutionId" | "date" | "lines" | "note"> & { source?: Order["source"]; invoiceNo?: string };

interface UiState {
  view: View;
  /** Clock, minutes from midnight (simulated, or real time after `goLive`). */
  t: number;
  playing: boolean;
  /** Simulated minutes per real second (1 = real time). */
  speed: number;
  selection: Selection;
  roofOff: boolean;
  /** Time the activity feed was last opened (for the unread badge). */
  feedSeenAt: number;
  markFeedSeen: () => void;
  /** Incremented to ask the active view to zoom / reset its camera. */
  cameraCmd: { n: number; action: "in" | "out" | "reset" };
  /** Fleet cards (all vehicles). */
  fleet: TruckInfo[];
  /** The day shown in 3D, on the map and in Livrări (today). */
  day: string;
  /** Today's routes and the vehicles' plan (from the real orders, or example orders while there are none). */
  today: DayResult;
  trucks: Truck[];
  /** Day worked on in Comenzi and Program (today, tomorrow…). */
  workDate: string;
  setWorkDate: (d: string) => void;
  /** Orders and saved plans per day, as loaded from the server. */
  orders: Record<string, Order[]>;
  plans: Record<string, DayPlan | null>;
  fetchDay: (date: string) => Promise<void>;
  /** Routes for any day (computed, cached until the data changes). */
  dayFor: (date: string) => DayResult;
  createOrder: (o: NewOrder) => Promise<Order | null>;
  updateOrder: (o: Order, patch: Partial<Pick<Order, "lines" | "note" | "status" | "invoiceNo" | "date" | "institutionId">>) => Promise<Order | null>;
  createTestOrders: (date: string) => Promise<void>;
  deleteTestOrders: (date: string) => Promise<void>;
  /** Plan actions (Program page and order details). */
  generatePlan: (date: string) => Promise<void>;
  resetPlan: (date: string) => Promise<void>;
  approvePlan: (date: string, approved: boolean) => Promise<void>;
  moveOrder: (date: string, orderId: string, truck: number) => Promise<void>;
  addUnplanned: (date: string) => Promise<void>;
  /** Warehouse confirms a vehicle is loaded: its goods leave the stock. */
  markLoaded: (date: string, truck: number) => Promise<void>;
  undoLoaded: (date: string, truck: number) => Promise<void>;
  /** Stock levels (null = never saved: starting values from the product list) and recent movements. */
  levels: Levels | null;
  moves: StockMove[];
  productsSaved: boolean;
  fetchStock: () => Promise<void>;
  stockMove: (move: Omit<StockMove, "id" | "ts">) => Promise<boolean>;
  saveProducts: (list: Product[] | null) => Promise<boolean>;
  updateFleet: (fleet: TruckInfo[]) => Promise<"server" | "local">;
  addTruck: () => void;
  removeLastTruck: () => void;
  /** Bumped whenever data changes, so views and cached days recompute. */
  dataVersion: number;
  /** Where shared data is kept: on the server (all computers) or only in this browser. */
  storage: "loading" | "server" | "local";
  loadSaved: () => Promise<void>;
  applyInstitutions: (list: Institution[] | null) => Promise<"server" | "local">;
  moveWarehouse: (pos: LngLat | null) => Promise<"server" | "local">;
  /** "sim" = simulated movement; "live" = trucks with a fresh GPS position are shown where they really are. */
  gpsMode: "sim" | "live";
  setGpsMode: (m: "sim" | "live") => void;
  live: Record<string, LivePos>;
  setLive: (l: Record<string, LivePos>) => void;
  /** Driver confirmations for today, by order number. */
  confirmations: Record<string, Confirmation>;
  setConfirmations: (c: Record<string, Confirmation>) => void;
  /** Short message at the bottom of the screen ("Comanda a fost salvată"). */
  toast: { id: number; text: string; tone: "ok" | "error" } | null;
  notify: (text: string, tone?: "ok" | "error") => void;
  /** Simplified 3D (no shadows, lower resolution) for older office computers. */
  lowGfx: boolean;
  setLowGfx: (v: boolean) => void;
  /** Jump to the current time and run in real time. */
  goLive: () => void;
  setView: (v: View) => void;
  setT: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  select: (s: Selection) => void;
  toggleRoof: () => void;
  camera: (action: "in" | "out" | "reset") => void;
}

export const DAY_START = 5 * 60;
export const DAY_END = 20 * 60;
export const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};

/** Is there at least one real order (also cancelled) for the day? Otherwise the day shows example orders. */
const isReal = (orders: Record<string, Order[]>, date: string) => (orders[date]?.length ?? 0) > 0;

const dayCache = new Map<string, { v: number; r: DayResult }>();

export const useUi = create<UiState>((set, get) => {
  const computeDay = (date: string): DayResult => {
    const { orders, plans, fleet, dataVersion } = get();
    const hit = dayCache.get(date);
    if (hit && hit.v === dataVersion) return hit.r;
    const real = isReal(orders, date);
    const r = planDay(date, real ? orders[date] : demoOrders(date), fleet, real ? (plans[date] ?? null) : null, !real);
    dayCache.set(date, { v: dataVersion, r });
    return r;
  };
  /** Recompute everything after orders, plans, institutions, warehouse or fleet changed. */
  const replan = () => {
    set((s) => ({ dataVersion: s.dataVersion + 1 }));
    const today = computeDay(get().day);
    set({ today, trucks: today.trucks });
  };
  const setOrders = (date: string, list: Order[]) => set((s) => ({ orders: { ...s.orders, [date]: list } }));
  const setPlan = (date: string, plan: DayPlan | null) => set((s) => ({ plans: { ...s.plans, [date]: plan } }));
  const savePlan = async (date: string, plan: Omit<DayPlan, "updatedAt" | "date"> | null) => {
    const res = await postJson<{ plan: DayPlan | null }>("/api/plan", { date, plan: plan && { ...plan, date } });
    if (!res) return false;
    setPlan(date, res.plan);
    replan();
    return true;
  };
  const current = (date: string) => {
    const r = computeDay(date);
    return { routes: r.routes, approved: r.saved?.approved ?? false, loaded: r.saved?.loaded ?? {} };
  };
  const requireReal = (date: string) => {
    if (isReal(get().orders, date)) return true;
    get().notify("Ziua are doar comenzi demo. Înregistrați comenzi (sau generați comenzi de test) pe pagina Comenzi.", "error");
    return false;
  };
  const day = todayIso();
  const initial = planDay(day, demoOrders(day), DEFAULT_FLEET, null, true);

  return {
    view: "warehouse",
    t: 6 * 60 + 5,
    playing: true,
    speed: 3,
    selection: null,
    roofOff: false,
    feedSeenAt: 6 * 60 + 5,
    markFeedSeen: () => set((s) => ({ feedSeenAt: s.t })),
    cameraCmd: { n: 0, action: "reset" },
    fleet: DEFAULT_FLEET,
    day,
    today: initial,
    trucks: initial.trucks,
    workDate: day,
    setWorkDate: (workDate) => {
      set({ workDate });
      void get().fetchDay(workDate);
    },
    orders: {},
    plans: {},
    fetchDay: async (date) => {
      const [o, p] = await Promise.all([getJson<{ orders: Order[] }>(`/api/orders?date=${date}`), getJson<{ plan: DayPlan | null }>(`/api/plan?date=${date}`)]);
      if (!o) return;
      const prev = get();
      const same = JSON.stringify(prev.orders[date] ?? null) === JSON.stringify(o.orders) && JSON.stringify(prev.plans[date] ?? null) === JSON.stringify(p?.plan ?? null);
      if (same && date in prev.orders) return;
      setOrders(date, o.orders);
      setPlan(date, p?.plan ?? null);
      replan();
    },
    dayFor: (date) => computeDay(date),
    createOrder: async (o) => {
      const res = await postJson<{ order: Order }>("/api/orders", { action: "create", order: o });
      if (!res) return null;
      setOrders(res.order.date, [...(get().orders[res.order.date] ?? []), res.order]);
      replan();
      get().notify(`Comanda ${res.order.no} a fost înregistrată.`);
      return res.order;
    },
    updateOrder: async (o, patch) => {
      const res = await postJson<{ order: Order }>("/api/orders", { action: "update", id: o.id, date: o.date, patch });
      if (!res) return null;
      const { orders } = get();
      const next = { ...orders, [o.date]: (orders[o.date] ?? []).filter((x) => x.id !== o.id) };
      next[res.order.date] = [...(next[res.order.date] ?? []).filter((x) => x.id !== o.id), res.order];
      if (res.order.date === o.date) next[o.date] = (orders[o.date] ?? []).map((x) => (x.id === o.id ? res.order : x));
      set({ orders: next });
      replan();
      return res.order;
    },
    createTestOrders: async (date) => {
      const list = demoOrders(date).map((o) => ({ institutionId: o.institutionId, date, lines: o.lines, source: "test" }));
      const res = await postJson<{ created: number }>("/api/orders", { action: "bulk", orders: list });
      if (!res) return;
      await get().fetchDay(date);
      get().notify(`${res.created} comenzi de test create pentru ${date.split("-").reverse().join(".")}.`);
    },
    deleteTestOrders: async (date) => {
      const res = await postJson<{ removed: number }>("/api/orders", { action: "delete-test", date });
      if (!res) return;
      if (get().plans[date]) await savePlan(date, null);
      await get().fetchDay(date);
      get().notify(`${res.removed} comenzi de test șterse.`);
    },
    generatePlan: async (date) => {
      if (!requireReal(date)) return;
      const r = computeDay(date);
      const { routes } = autoRoutes(r.orders, get().fleet);
      if (await savePlan(date, { routes, approved: false, loaded: r.saved?.loaded ?? {} })) get().notify("Traseele au fost generate din nou.");
    },
    resetPlan: async (date) => {
      if (await savePlan(date, null)) get().notify("Traseele se fac din nou automat.");
    },
    approvePlan: async (date, approved) => {
      if (!requireReal(date)) return;
      if (await savePlan(date, { ...current(date), approved })) get().notify(approved ? "Planul a fost aprobat. Comenzile noi pentru această zi așteaptă la „Neplanificate”." : "Planul nu mai este aprobat.");
    },
    moveOrder: async (date, orderId, truck) => {
      if (!requireReal(date)) return;
      const cur = current(date);
      const r = computeDay(date);
      const order = r.orders.find((o) => o.id === orderId);
      if (!order) return;
      const without = cur.routes.map((x) => ({ ...x, orderIds: x.orderIds.filter((id) => id !== orderId) }));
      // Put it where it adds the least distance on the chosen vehicle.
      const target = without.filter((x) => x.truck === truck);
      const others = without.filter((x) => x.truck !== truck);
      const placed = addToRoutes(target.length ? target : [{ truck, orderIds: [] }], [order], r.orders, get().fleet.map((f) => (f.number === truck ? { ...f, capacityKg: 1e9 } : { ...f, active: false })));
      await savePlan(date, { ...cur, routes: [...others, ...placed.routes.filter((x) => x.truck === truck)] });
    },
    addUnplanned: async (date) => {
      if (!requireReal(date)) return;
      const r = computeDay(date);
      const res = addToRoutes(r.routes, r.unplanned, r.orders, get().fleet);
      await savePlan(date, { ...current(date), routes: res.routes });
      get().notify(res.unplanned.length ? `${r.unplanned.length - res.unplanned.length} adăugate; ${res.unplanned.length} nu mai încap în nicio mașină.` : "Comenzile au fost adăugate în trasee.", res.unplanned.length ? "error" : "ok");
    },
    markLoaded: async (date, truck) => {
      if (!requireReal(date)) return;
      const r = computeDay(date);
      const tr = r.trucks.find((x) => x.number === truck);
      if (!tr?.stops.length) return;
      const ok = await get().stockMove({ type: "iesire", lines: mergeLines(tr.stops.flatMap((s) => s.lines)), note: `Încărcare ${tr.label} · ${date.split("-").reverse().join(".")}`, ref: `incarcare:${date}:${truck}` });
      if (!ok) return;
      const cur = current(date);
      if (await savePlan(date, { ...cur, loaded: { ...cur.loaded, [truck]: Date.now() } })) get().notify(`${tr.label} încărcată. Produsele au fost scăzute din stoc.`);
    },
    undoLoaded: async (date, truck) => {
      const r = computeDay(date);
      const tr = r.trucks.find((x) => x.number === truck);
      if (!tr) return;
      const ok = await get().stockMove({ type: "intrare", lines: mergeLines(tr.stops.flatMap((s) => s.lines)), note: `Anulare încărcare ${tr.label} · ${date.split("-").reverse().join(".")}`, ref: `anulare:${date}:${truck}:${Date.now()}` });
      if (!ok) return;
      const cur = current(date);
      const loaded = { ...cur.loaded };
      delete loaded[truck];
      if (await savePlan(date, { ...cur, loaded })) get().notify(`Încărcarea ${tr.label} a fost anulată, produsele au revenit în stoc.`);
    },
    levels: null,
    moves: [],
    productsSaved: false,
    fetchStock: async () => {
      const res = await getJson<{ levels: Levels | null; products: Product[] | null; moves: StockMove[] }>("/api/stock");
      if (!res) return;
      replaceProducts(res.products);
      set({ levels: res.levels, moves: res.moves, productsSaved: !!res.products?.length });
      replan();
    },
    stockMove: async (move) => {
      const res = await postJson<{ levels?: Levels; duplicate?: boolean }>("/api/stock", { action: "move", move, base: baseLevels() });
      if (!res) return false;
      await get().fetchStock();
      return true;
    },
    saveProducts: async (list) => {
      const res = await postJson("/api/stock", { action: "products", products: list });
      if (!res) return false;
      await get().fetchStock();
      return true;
    },
    updateFleet: async (fleet) => {
      const sorted = [...fleet].sort((a, b) => a.number - b.number);
      set({ fleet: sorted });
      replan();
      const sel = get().selection;
      if (sel?.kind === "truck" && !get().trucks.some((t) => t.id === sel.id)) set({ selection: null });
      const where = await persist({ fleet: sorted });
      set({ storage: where });
      return where;
    },
    addTruck: () => {
      const { fleet } = get();
      if (fleet.length >= MAX_TRUCKS) return;
      const next = Math.max(0, ...fleet.map((f) => f.number)) + 1;
      void get().updateFleet([...fleet, { ...defaultTruckInfo(next), plate: "", trackerId: "", gpsOk: false, driver: "", phone: "" }]);
    },
    removeLastTruck: () => {
      const { fleet } = get();
      if (fleet.length > 1) void get().updateFleet(fleet.slice(0, -1));
    },
    dataVersion: 0,
    storage: "loading",
    loadSaved: async () => {
      let shared: Shared | null = null;
      let where: "server" | "local" = "local";
      const res = await getJson<Shared>("/api/state");
      if (res) {
        shared = res;
        where = "server";
      }
      if (!shared) shared = { institutions: cache.load(KEYS.institutions), warehouse: cache.load(KEYS.warehouse), fleet: cache.load(KEYS.fleet) };
      if (shared.warehouse) setWarehouse(shared.warehouse);
      if (shared.institutions?.length) replaceInstitutions(shared.institutions);
      set({ fleet: shared.fleet?.length ? shared.fleet : DEFAULT_FLEET, storage: where });
      replan();
      if (where === "server") {
        const d = get().day;
        await Promise.all([get().fetchStock(), get().fetchDay(d), get().fetchDay(nextWorkday(d))]);
      }
    },
    applyInstitutions: async (list) => {
      replaceInstitutions(list);
      set({ selection: null });
      replan();
      const where = await persist({ institutions: list });
      set({ storage: where });
      return where;
    },
    moveWarehouse: async (pos) => {
      setWarehouse(pos ?? DEFAULT_WAREHOUSE);
      replan();
      const where = await persist({ warehouse: pos });
      set({ storage: where });
      return where;
    },
    gpsMode: "sim",
    setGpsMode: (gpsMode) => {
      set({ gpsMode });
      // Real positions only make sense against the real clock.
      if (gpsMode === "live") get().goLive();
    },
    live: {},
    setLive: (live) => set({ live }),
    confirmations: {},
    setConfirmations: (confirmations) => set({ confirmations }),
    toast: null,
    notify: (text, tone = "ok") => {
      const id = Date.now();
      set({ toast: { id, text, tone } });
      setTimeout(() => get().toast?.id === id && set({ toast: null }), tone === "error" ? 7000 : 3500);
    },
    lowGfx: false,
    setLowGfx: (lowGfx) => {
      cache.save(KEYS.lowGfx, lowGfx);
      set({ lowGfx });
    },
    goLive: () => set({ t: Math.min(DAY_END, Math.max(DAY_START, nowMinutes())), speed: 1, playing: true }),
    setView: (view) => set({ view }),
    setT: (t) => set({ t: Math.min(DAY_END, Math.max(DAY_START, t)) }),
    setPlaying: (playing) => set({ playing }),
    setSpeed: (speed) => set({ speed }),
    select: (selection) => set({ selection }),
    toggleRoof: () => set((s) => ({ roofOff: !s.roofOff })),
    camera: (action) => set((s) => ({ cameraCmd: { n: s.cameraCmd.n + 1, action } })),
  };
});

/** Newest position for a truck: from its tracker, or from the driver's phone (sent as "T<number>"). */
export function liveFix(live: Record<string, LivePos>, tr: { trackerId: string; number: number }): LivePos | undefined {
  const a = tr.trackerId ? live[tr.trackerId] : undefined;
  const b = live[`T${tr.number}`];
  return !a ? b : !b ? a : a.ts >= b.ts ? a : b;
}

/** Graphics preference: saved choice, else simplified on machines with few cores. */
export function initialLowGfx(): boolean {
  const saved = cache.load<boolean>(KEYS.lowGfx);
  if (saved !== null) return saved;
  return typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 2;
}

/** The clock rounded to whole minutes: use this in panels so they re-render once a sim-minute. */
export const useMinute = () => useUi((s) => Math.floor(s.t));

export const useTrucks = () => useUi((s) => s.trucks);

/** The plan of a day, recomputed when the data changes. */
export const useDay = (date: string) => {
  useUi((s) => s.dataVersion);
  return useUi.getState().dayFor(date);
};

/** Institution name for an order, safe when the institution list changed. */
export const instName = (id: string) => INSTITUTION_BY_ID.get(id)?.name ?? "Instituție necunoscută";

export const lastOrderOf = (orders: Record<string, Order[]>, institutionId: string): Order | null => {
  let best: Order | null = null;
  for (const list of Object.values(orders)) for (const o of list) if (o.institutionId === institutionId && o.status !== "anulata" && (!best || o.createdAt > best.createdAt)) best = o;
  return best;
};

export const linesKey = (lines: OrderLine[]) => lines.map((l) => `${l.productId}:${l.qty}`).join("|");
export { addDays, nextWorkday };
