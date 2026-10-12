import { create } from "zustand";
import { buildFleet, DEFAULT_TRUCK_COUNT, DEFAULT_WAREHOUSE, MAX_TRUCKS, replaceInstitutions, setWarehouse } from "./seed";
import type { Institution, LngLat, Selection, Truck } from "./types";

const INSTITUTIONS_KEY = "nobilprest.institutions.v1";
const WAREHOUSE_KEY = "nobilprest.warehouse.v1";

/** Latest position reported by a GPS tracker (from /api/gps). */
export interface LivePos {
  lng: number;
  lat: number;
  /** Epoch milliseconds. */
  ts: number;
  speed?: number;
  heading?: number;
}

const save = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
const load = <T,>(key: string): T | null => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};

// v2: the default became the real 16-truck fleet, so older saved sizes are ignored.
const FLEET_KEY = "nobilprest.truckCount.v2";

export type View = "warehouse" | "map" | "deliveries" | "planning" | "data";

interface UiState {
  view: View;
  /** Simulated clock, minutes from midnight. */
  t: number;
  playing: boolean;
  /** Simulated minutes per real second. */
  speed: number;
  selection: Selection;
  roofOff: boolean;
  /** Time the activity feed was last opened (for the unread badge). */
  feedSeenAt: number;
  markFeedSeen: () => void;
  /** Incremented to ask the active view to zoom / reset its camera. */
  cameraCmd: { n: number; action: "in" | "out" | "reset" };
  /** The fleet with today's plan. Its size can be changed from the Trucks tab. */
  trucks: Truck[];
  setTruckCount: (n: number) => void;
  loadSavedFleet: () => void;
  /** Bumped whenever institutions or the warehouse location change, so views redraw. */
  dataVersion: number;
  /** Use imported institutions (null = back to demo). Returns false if they could not be saved in the browser. */
  applyInstitutions: (list: Institution[] | null) => boolean;
  moveWarehouse: (pos: LngLat | null) => void;
  /** "sim" = simulated movement; "live" = trucks with a fresh GPS position are shown where they really are. */
  gpsMode: "sim" | "live";
  setGpsMode: (m: "sim" | "live") => void;
  live: Record<string, LivePos>;
  setLive: (l: Record<string, LivePos>) => void;
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

export const useUi = create<UiState>((set) => ({
  view: "warehouse",
  t: 6 * 60 + 5,
  playing: true,
  speed: 3,
  selection: null,
  roofOff: false,
  feedSeenAt: 6 * 60 + 5,
  markFeedSeen: () => set((s) => ({ feedSeenAt: s.t })),
  cameraCmd: { n: 0, action: "reset" },
  trucks: buildFleet(DEFAULT_TRUCK_COUNT),
  setTruckCount: (n) => {
    const count = Math.min(MAX_TRUCKS, Math.max(1, n));
    try {
      localStorage.setItem(FLEET_KEY, String(count));
    } catch {
      // Storage unavailable: the change still applies for this session.
    }
    set((s) => ({ trucks: buildFleet(count), selection: s.selection?.kind === "truck" ? null : s.selection }));
  },
  dataVersion: 0,
  applyInstitutions: (list) => {
    replaceInstitutions(list);
    const ok = save(INSTITUTIONS_KEY, list);
    set((s) => ({ trucks: buildFleet(s.trucks.length), selection: null, dataVersion: s.dataVersion + 1 }));
    return ok;
  },
  moveWarehouse: (pos) => {
    setWarehouse(pos ?? DEFAULT_WAREHOUSE);
    save(WAREHOUSE_KEY, pos);
    set((s) => ({ trucks: buildFleet(s.trucks.length), dataVersion: s.dataVersion + 1 }));
  },
  gpsMode: "sim",
  setGpsMode: (gpsMode) => set({ gpsMode }),
  live: {},
  setLive: (live) => set({ live }),
  loadSavedFleet: () => {
    // Imported data first, so the fleet below is planned on it.
    const wh = load<LngLat>(WAREHOUSE_KEY);
    if (wh) setWarehouse(wh);
    const insts = load<Institution[]>(INSTITUTIONS_KEY);
    if (insts?.length) replaceInstitutions(insts);
    if (wh || insts?.length) set((s) => ({ trucks: buildFleet(s.trucks.length), dataVersion: s.dataVersion + 1 }));
    try {
      const n = Number(localStorage.getItem(FLEET_KEY));
      if (n >= 1 && n <= MAX_TRUCKS && n !== DEFAULT_TRUCK_COUNT) set({ trucks: buildFleet(n) });
    } catch {
      // Ignore: default fleet.
    }
  },
  setView: (view) => set({ view }),
  setT: (t) => set({ t: Math.min(DAY_END, Math.max(DAY_START, t)) }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  select: (selection) => set({ selection }),
  toggleRoof: () => set((s) => ({ roofOff: !s.roofOff })),
  camera: (action) => set((s) => ({ cameraCmd: { n: s.cameraCmd.n + 1, action } })),
}));

/** The clock rounded to whole minutes: use this in panels so they re-render once a sim-minute. */
export const useMinute = () => useUi((s) => Math.floor(s.t));

export const useTrucks = () => useUi((s) => s.trucks);
