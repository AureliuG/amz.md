"use client";

import { Box, Map as MapIcon, Pause, Play, Search, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { INSTITUTIONS, TRUCKS } from "@/lib/seed";
import { fmtTime } from "@/lib/sim";
import { useMinute, useUi } from "@/lib/store";

const SPEEDS = [1, 3, 10, 30];

export function TopBar() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const playing = useUi((s) => s.playing);
  const setPlaying = useUi((s) => s.setPlaying);
  const speed = useUi((s) => s.speed);
  const setSpeed = useUi((s) => s.setSpeed);
  const t = useMinute();

  return (
    <header className="pointer-events-auto flex h-14 items-center gap-3 border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur">
      <div className="flex items-center gap-2 pr-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#4d82ff] to-[#1f3fb3] text-white shadow">
          <Box size={18} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-slate-900">DepotOps</span>
      </div>
      <SearchBox />
      <div className="ml-auto flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            ["warehouse", "Warehouse", Warehouse],
            ["map", "Moldova", MapIcon],
          ] as const
        ).map(([v, label, Icon]) => (
          <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${view === v ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1">
        <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> {fmtTime(t)}
        </span>
        <button aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)} className="grid h-6 w-6 place-items-center rounded-md text-slate-600 hover:bg-slate-100">
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <div className="hidden items-center md:flex">
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={`rounded px-1.5 text-[11px] ${speed === s ? "font-semibold text-blue-700" : "text-slate-400 hover:text-slate-700"}`}>
              {s === 1 ? "1×" : `${s * 60}×`}
            </button>
          ))}
        </div>
      </div>
      <span className="hidden rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200 lg:inline">Demo data</span>
    </header>
  );
}

function SearchBox() {
  const [q, setQ] = useState("");
  const select = useUi((s) => s.select);
  const setView = useUi((s) => s.setView);
  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    const trucks = TRUCKS.filter((t) => `${t.plate} ${t.driver}`.toLowerCase().includes(n)).map((t) => ({ key: t.id, label: t.plate, sub: t.driver, go: () => select({ kind: "truck", id: t.id }) }));
    const insts = INSTITUTIONS.filter((i) => `${i.name} ${i.town}`.toLowerCase().includes(n))
      .slice(0, 8)
      .map((i) => ({
        key: i.id,
        label: i.name,
        sub: i.town,
        go: () => {
          setView("map");
          select({ kind: "institution", id: i.id });
        },
      }));
    return [...trucks, ...insts].slice(0, 9);
  }, [q, select, setView]);

  return (
    <div className="relative hidden w-[min(380px,32vw)] md:block">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search trucks, drivers, institutions…" className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-[12px] outline-none focus:border-blue-300 focus:bg-white" />
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-10 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.map((r) => (
            <button
              key={r.key}
              onClick={() => {
                r.go();
                setQ("");
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-blue-50"
            >
              <span className="truncate font-medium text-slate-800">{r.label}</span>
              <span className="shrink-0 text-slate-400">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
