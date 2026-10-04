import { create } from "zustand";
import type { Selection } from "./types";

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
