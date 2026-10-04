"use client";

import { Eye, EyeOff, Minus, Plus, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { DAY_END, useUi } from "@/lib/store";
import { FleetPanel, TrackingPanel } from "./hud/BottomPanels";
import { DetailPanel } from "./hud/DetailPanel";
import { Kpis } from "./hud/Kpis";
import { TopBar } from "./hud/TopBar";

// WebGL views can't render on the server: load them in the browser only.
const Loading = () => <div className="grid h-full place-items-center text-[12px] text-slate-400">Se încarcă…</div>;
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
  // Both views stay mounted once opened, so switching is instant and WebGL contexts aren't torn down.
  const [mapOpened, setMapOpened] = useState(false);
  useEffect(() => {
    if (view === "map") setMapOpened(true);
  }, [view]);
  return (
    <div className="flex h-dvh flex-col">
      <TopBar />
      <main className="relative flex-1 overflow-hidden">
        <div className={`absolute inset-0 isolate ${view === "warehouse" ? "" : "invisible"}`}>
          <WarehouseScene />
        </div>
        {mapOpened && (
          <div className={`absolute inset-0 ${view === "map" ? "" : "invisible"}`}>
            <MoldovaMap />
          </div>
        )}
        {/* HUD: the overlay never blocks the scene except where panels are */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-3 p-3 sm:p-4">
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
      </main>
    </div>
  );
}
