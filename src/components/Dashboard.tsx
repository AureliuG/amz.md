"use client";

import { Eye, EyeOff, Minus, Plus, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { DAY_END, initialLowGfx, useUi } from "@/lib/store";
import { FleetPanel, TrackingPanel } from "./hud/BottomPanels";
import { DeliveriesView } from "./DeliveriesView";
import { DataView } from "./DataView";
import { GuideView } from "./GuideView";
import { WelcomeModal } from "./WelcomeModal";
import { PlanningView } from "./PlanningView";
import { PrintRoot } from "./PrintSheets";
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

/** Is WebGL available? Old office PCs or remote desktops sometimes lack it; the 3D and map views need it. */
function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function NoGraphics({ what }: { what: string }) {
  const setView = useUi((s) => s.setView);
  return (
    <div className="grid h-full place-items-center bg-[#eef2fb] p-6">
      <div className="max-w-md rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
        <div className="text-[14px] font-semibold text-slate-900">{what} nu poate fi afișat pe acest calculator</div>
        <p className="mt-1 text-[12.5px] text-slate-500">Browserul nu are accelerare grafică (WebGL). Actualizați Chrome/Edge sau driverul plăcii video. Restul aplicației funcționează normal.</p>
        <div className="mt-3 flex justify-center gap-2">
          <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white" onClick={() => setView("deliveries")}>
            Deschide Livrări
          </button>
          <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-700" onClick={() => setView("planning")}>
            Program
          </button>
        </div>
      </div>
    </div>
  );
}

/** If a 3D/map view crashes, show a message instead of a blank page. */
class ViewBoundary extends Component<{ what: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error(err);
  }
  render() {
    return this.state.failed ? <NoGraphics what={this.props.what} /> : this.props.children;
  }
}

/** Driver confirmations ("Livrat", "Problemă") for today, every 15 s. */
function useConfirmations() {
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        if (res.ok && !stop) useUi.getState().setConfirmations((await res.json()).confirmations ?? {});
      } catch {
        // Server not reachable: nothing to show.
      }
    };
    void poll();
    const id = setInterval(poll, 15_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);
}

/** Poll the GPS intake while live mode is on or the Date page is open. */
function useLiveGps() {
  const gpsMode = useUi((s) => s.gpsMode);
  const view = useUi((s) => s.view);
  useEffect(() => {
    if (gpsMode !== "live" && view !== "data") return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/gps", { cache: "no-store" });
        if (res.ok && !stop) useUi.getState().setLive((await res.json()).positions ?? {});
      } catch {
        // Offline: keep the last positions.
      }
    };
    void poll();
    const id = setInterval(poll, 10_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [gpsMode, view]);
}

export function Dashboard() {
  useClock();
  useLiveGps();
  useConfirmations();
  const view = useUi((s) => s.view);
  const [webgl, setWebgl] = useState(true);
  useEffect(() => {
    useUi.setState({ lowGfx: initialLowGfx() });
    setWebgl(hasWebGL());
    void useUi.getState().loadSaved();
  }, []);
  // Keyboard: Esc closes details, 1–6 switch pages, space plays/pauses the clock.
  useEffect(() => {
    const views = ["warehouse", "map", "deliveries", "planning", "data", "guide"] as const;
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if (e.key === "Escape") return ui.select(null);
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "1" && e.key <= "6") ui.setView(views[Number(e.key) - 1]);
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
    <>
    <div id="app-root" className="flex h-dvh flex-col">
      <TopBar />
      <main className="relative flex-1 overflow-hidden">
        <div className={`absolute inset-0 isolate transition-opacity duration-500 ${view === "warehouse" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {webgl ? (
            <ViewBoundary what="Depozitul 3D">
              <WarehouseScene />
            </ViewBoundary>
          ) : (
            <NoGraphics what="Depozitul 3D" />
          )}
        </div>
        {mapOpened && (
          <div className={`absolute inset-0 transition-opacity duration-500 ${view === "map" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            {webgl ? (
              <ViewBoundary what="Harta">
                <MoldovaMap />
              </ViewBoundary>
            ) : (
              <NoGraphics what="Harta" />
            )}
          </div>
        )}
        {view === "data" && <DataView />}
        {view === "guide" && <GuideView />}
        {(view === "deliveries" || view === "planning") && (
          <>
            {view === "deliveries" ? <DeliveriesView /> : <PlanningView />}
            <div className="pointer-events-none absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
              <DetailPanel />
            </div>
          </>
        )}
        {/* HUD: the overlay never blocks the scene except where panels are */}
        <div className={`pointer-events-none absolute inset-0 z-10 flex ${view === "deliveries" || view === "planning" || view === "data" || view === "guide" ? "hidden" : ""}`} data-hud>
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
    <PrintRoot />
    <WelcomeModal />
    </>
  );
}
