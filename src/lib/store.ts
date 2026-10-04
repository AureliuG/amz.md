import { create } from "zustand";
import { buildFleet, DEFAULT_TRUCK_COUNT, MAX_TRUCKS } from "./seed";
import type { Selection, Truck } from "./types";

const FLEET_KEY = "nobilprest.truckCount";

export type View = "warehouse" | "map";

interface UiState {
  view: View;
  /** Simulated clock, minutes from midnight. */
  t: number;
  playing: boolean;
  /** Simulated minutes per real second. */
  speed: number;
  selection: Selection;
  roofOff: boolean;
  /** Incremented to ask the active view to zoom / reset its camera. */
  cameraCmd: { n: number; action: "in" | "out" | "reset" };
  /** The fleet with today's plan. Its size can be changed from the Trucks tab. */
  trucks: Truck[];
  setTruckCount: (n: number) => void;
  loadSavedFleet: () => void;
  setView: (v: View) => void;
  setT: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  select: (s: Selection) => void;
  toggleRoof: () => void;
  camera: (action: "in" | "out" | "reset") => void;
}

export const DAY_START = 5 * 60 + 30;
export const DAY_END = 18 * 60;

export const useUi = create<UiState>((set) => ({
  view: "warehouse",
  t: 6 * 60 + 5,
  playing: true,
  speed: 3,
  selection: null,
  roofOff: false,
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
  loadSavedFleet: () => {
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
