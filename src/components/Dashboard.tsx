"use client";

import { Eye, EyeOff, Minus, Plus, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { DAY_END, useUi } from "@/lib/store";
import { FleetPanel, TrackingPanel } from "./hud/BottomPanels";
import { DeliveriesView } from "./DeliveriesView";
import { PlanningView } from "./PlanningView";
import { DetailPanel } from "./hud/DetailPanel";
import { Kpis } from "./hud/Kpis";
import { TopBar } from "./hud/TopBar";

// WebGL views can't render on the server: load them in the browser only.
const Loading = () => (
  <div className="grid h-full place-items-center bg-[#eef2fb]">
    <div className="flex flex-col items-center gap-3">
      <div className="grid h-12 w-12 animate-pulse place-items-center rounded-2xl bg-gradient-to-br from-[#4d82ff] to-[#1f3fb3] text-[16px] font-bold text-white shadow-lg">NP</div>
      <div className="text-[12px] text-slate-400">Se încarcă…</div>
    </div>
  </div>
);
const WarehouseScene = dynamic(() => import("./scene/WarehouseScene"), { ssr: false, loading: Loading });
const MoldovaMap = dynamic(() => import("./map/MoldovaMap"), { ssr: false, loading: Loading });

/** Drives the simulated clock. Live mode will follow the real clock and incoming events instead. */
function useClock() {
  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const s = useUi.getState();
      if (s.playing) {
        // speed 1 = real time; otherwise `speed` simulated minutes per second.
        const next = s.t + (s.speed === 1 ? dt / 60 : dt * s.speed);
        if (next >= DAY_END) s.setPlaying(false);
        s.setT(next);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

function ViewControls() {
  const camera = useUi((s) => s.camera);
  const view = useUi((s) => s.view);
  const roofOff = useUi((s) => s.roofOff);
  const toggleRoof = useUi((s) => s.toggleRoof);
  const btn = "grid h-8 w-8 place-items-center text-slate-600 hover:bg-slate-50 hover:text-blue-700";
  return (
    <div className="pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-white/70 bg-white/90 shadow-[0_8px_30px_-12px_rgba(31,63,179,0.25)]">
      <button aria-label="Mărește" className={btn} onClick={() => camera("in")}>
        <Plus size={15} />
      </button>
      <button aria-label="Micșorează" className={btn} onClick={() => camera("out")}>
        <Minus size={15} />
      </button>
      <button aria-label="Vedere inițială" className={btn} onClick={() => camera("reset")}>
        <RotateCcw size={14} />
      </button>
      {view === "warehouse" && (
        <button aria-label={roofOff ? "Arată acoperișul" : "Vezi înăuntru"} title={roofOff ? "Arată acoperișul" : "Vezi înăuntru"} className={`${btn} ${roofOff ? "text-blue-700" : ""}`} onClick={toggleRoof}>
          {roofOff ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
    </div>
  );
}

export function Dashboard() {
  useClock();
  const view = useUi((s) => s.view);
  useEffect(() => useUi.getState().loadSavedFleet(), []);
  // Keyboard: Esc closes details, 1–4 switch pages, space plays/pauses the clock.
  useEffect(() => {
    const views = ["warehouse", "map", "deliveries", "planning"] as const;
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if (e.key === "Escape") return ui.select(null);
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "1" && e.key <= "4") ui.setView(views[Number(e.key) - 1]);
      if (e.key === " ") {
        e.preventDefault();
        ui.setPlaying(!ui.playing);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Both views stay mounted once opened, so switching is instant and WebGL contexts aren't torn down.
  const [mapOpened, setMapOpened] = useState(false);
  useEffect(() => {
    if (view === "map") setMapOpened(true);
  }, [view]);
  return (
    <div className="flex h-dvh flex-col">
      <TopBar />
      <main className="relative flex-1 overflow-hidden">
        <div className={`absolute inset-0 isolate transition-opacity duration-500 ${view === "warehouse" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <WarehouseScene />
        </div>
        {mapOpened && (
          <div className={`absolute inset-0 transition-opacity duration-500 ${view === "map" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            <MoldovaMap />
          </div>
        )}
        {(view === "deliveries" || view === "planning") && (
          <>
            {view === "deliveries" ? <DeliveriesView /> : <PlanningView />}
            <div className="pointer-events-none absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
              <DetailPanel />
            </div>
          </>
        )}
        {/* HUD: the overlay never blocks the scene except where panels are */}
        <div className={`pointer-events-none absolute inset-0 z-10 flex ${view === "deliveries" || view === "planning" ? "hidden" : ""}`} data-hud>
          <div className="flex h-full w-full flex-col justify-between gap-3 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <Kpis />
            <div className="flex items-start gap-2">
              <div className="hidden lg:block">
                <DetailPanel />
              </div>
              <ViewControls />
            </div>
          </div>
          <div className="lg:hidden">
            <DetailPanel />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <TrackingPanel />
            <FleetPanel />
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}
