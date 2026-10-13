import { create } from "zustand";
import { buildFleet, DEFAULT_FLEET, DEFAULT_WAREHOUSE, defaultTruckInfo, MAX_TRUCKS, replaceInstitutions, setWarehouse } from "./seed";
import type { Confirmation, Institution, LngLat, Selection, Truck, TruckInfo } from "./types";

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
    const res = await fetch("/api/state", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(part) });
    return res.ok ? "server" : "local";
  } catch {
    return "local";
  }
}

export type View = "warehouse" | "map" | "deliveries" | "planning" | "data";

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
  /** Fleet cards (all vehicles) and today's plan for the active ones. */
  fleet: TruckInfo[];
  trucks: Truck[];
  updateFleet: (fleet: TruckInfo[]) => Promise<"server" | "local">;
  addTruck: () => void;
  removeLastTruck: () => void;
  /** Bumped whenever institutions or the warehouse location change, so views redraw. */
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

export const DAY_START = 5 * 60 + 30;
export const DAY_END = 20 * 60;
export const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};

export const useUi = create<UiState>((set, get) => {
  /** Rebuild today's plan after institutions, warehouse or fleet changed. */
  const replan = (fleet = get().fleet) => set((s) => ({ fleet, trucks: buildFleet(fleet), dataVersion: s.dataVersion + 1 }));
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
    trucks: buildFleet(DEFAULT_FLEET),
    updateFleet: async (fleet) => {
      const sorted = [...fleet].sort((a, b) => a.number - b.number);
      replan(sorted);
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
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (res.ok) {
          shared = (await res.json()) as Shared;
          where = "server";
        }
      } catch {
        // Fall back to the browser cache below.
      }
      if (!shared) shared = { institutions: cache.load(KEYS.institutions), warehouse: cache.load(KEYS.warehouse), fleet: cache.load(KEYS.fleet) };
      if (shared.warehouse) setWarehouse(shared.warehouse);
      if (shared.institutions?.length) replaceInstitutions(shared.institutions);
      replan(shared.fleet?.length ? shared.fleet : DEFAULT_FLEET);
      set({ storage: where });
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
