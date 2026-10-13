"use client";

import { Bell, CalendarRange, Database, ListChecks, Map as MapIcon, Pause, Play, Search, TriangleAlert, Warehouse } from "lucide-react";
import { computeAlerts, type Severity } from "@/lib/alerts";
import { useEffect, useMemo, useRef, useState } from "react";
import { eventsUntil, type EventKind } from "@/lib/events";
import { INSTITUTIONS } from "@/lib/seed";
import { fmtTime } from "@/lib/sim";
import { DAY_END, DAY_START, liveFix, useMinute, useTrucks, useUi } from "@/lib/store";

const SPEEDS = [3, 10, 30];
const today = () => new Date().toLocaleDateString("ro-MD", { weekday: "short", day: "2-digit", month: "2-digit" });
const todayLong = () => new Date().toLocaleDateString("ro-MD", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function TopBar() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const playing = useUi((s) => s.playing);
  const setPlaying = useUi((s) => s.setPlaying);
  const speed = useUi((s) => s.speed);
  const setSpeed = useUi((s) => s.setSpeed);
  const t = useMinute();

  return (
    <header className="pointer-events-auto relative z-30 flex h-14 items-center gap-3 border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur">
      <div className="flex items-center gap-2 pr-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#4d82ff] to-[#1f3fb3] text-[12px] font-bold tracking-tight text-white shadow">NP</div>
        <span className="leading-tight">
          <span className="block whitespace-nowrap text-[15px] font-semibold tracking-tight text-slate-900">Nobil Prest</span>
          <span className="hidden whitespace-nowrap text-[10px] text-slate-400 xl:block">Depozit & livrări</span>
        </span>
      </div>
      <SearchBox />
      <div className="ml-auto flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            ["warehouse", "Depozit", Warehouse],
            ["map", "Moldova", MapIcon],
            ["deliveries", "Livrări", ListChecks],
            ["planning", "Program", CalendarRange],
            ["data", "Date", Database],
          ] as const
        ).map(([v, label, Icon]) => (
          <button key={v} onClick={() => setView(v)} title={label} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${view === v ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            <Icon size={14} />
            <span className="hidden 2xl:inline">{label}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1">
        <span title={todayLong()} className="flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> <span className="hidden font-normal text-emerald-700/80 2xl:inline">{today()}</span> {fmtTime(t)}
        </span>
        <button aria-label={playing ? "Pauză" : "Pornește"} onClick={() => setPlaying(!playing)} className="grid h-6 w-6 place-items-center rounded-md text-slate-600 hover:bg-slate-100">
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <input
          type="range"
          aria-label="Ora zilei"
          min={DAY_START}
          max={DAY_END}
          step={1}
          value={t}
          onChange={(e) => useUi.getState().setT(Number(e.target.value))}
          className="time-slider hidden w-28 xl:block"
          style={{ ["--p" as string]: `${((t - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}
        />
        <div className="hidden items-center md:flex">
          <button onClick={() => useUi.getState().goLive()} title="Ora reală, în timp real" className={`rounded px-1.5 text-[11px] ${speed === 1 ? "font-semibold text-blue-700" : "text-slate-400 hover:text-slate-700"}`}>
            Acum
          </button>
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={`rounded px-1.5 text-[11px] ${speed === s ? "font-semibold text-blue-700" : "text-slate-400 hover:text-slate-700"}`}>
              {`${s * 60}×`}
            </button>
          ))}
        </div>
      </div>
      <AlertsButton />
      <ActivityBell />
      <LiveBadge />
      <span className="hidden whitespace-nowrap rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200 lg:inline">Date demo</span>
    </header>
  );
}

function SearchBox() {
  const [q, setQ] = useState("");
  const select = useUi((s) => s.select);
  const setView = useUi((s) => s.setView);
  const fleet = useTrucks();
  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 1) return [];
    const trucks = fleet.filter((t) => `${t.label} ${t.number} ${t.plate} ${t.driver}`.toLowerCase().includes(n)).map((t) => ({ key: t.id, label: t.plate ? `${t.label} · ${t.plate}` : t.label, sub: t.driver, go: () => select({ kind: "truck", id: t.id }) }));
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
  }, [q, select, setView, fleet]);

  return (
    <div className="relative hidden w-[min(300px,22vw)] md:block">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută mașini, șoferi, instituții…" className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-[12px] outline-none focus:border-blue-300 focus:bg-white" />
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

const KIND_STYLE: Record<EventKind, string> = {
  load: "bg-amber-400",
  depart: "bg-blue-500",
  arrive: "bg-sky-400",
  deliver: "bg-emerald-500",
  return: "bg-violet-500",
};

/** Live activity feed: departures, arrivals and deliveries as they happen. */
function ActivityBell() {
  const [open, setOpen] = useState(false);
  const t = useMinute();
  const trucks = useTrucks();
  const seenAt = useUi((s) => s.feedSeenAt);
  const markSeen = useUi((s) => s.markFeedSeen);
  const select = useUi((s) => s.select);
  const events = useMemo(() => eventsUntil(trucks, t, 40), [trucks, t]);
  const unread = open ? 0 : events.filter((e) => e.t > seenAt).length;
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    markSeen();
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, t, markSeen]);

  return (
    <div ref={box} className="relative">
      <button aria-label="Activitate" onClick={() => setOpen(!open)} className={`relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:text-blue-700 ${open ? "text-blue-700 ring-2 ring-blue-100" : ""}`}>
        <Bell size={15} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="panel-in absolute right-0 top-11 z-50 w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2 text-[12px] font-semibold text-slate-800">Activitate azi</div>
          <ul className="max-h-[420px] overflow-y-auto py-1">
            {events.length === 0 && <li className="px-3 py-4 text-center text-[12px] text-slate-400">Încă nimic azi.</li>}
            {events.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => {
                    select(e.institutionId ? { kind: "institution", id: e.institutionId } : { kind: "truck", id: e.truckId });
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_STYLE[e.kind]}`} />
                  <span className="flex-1 text-[11.5px] leading-snug text-slate-700">{e.text}</span>
                  <span className="text-[10px] tabular-nums text-slate-400">{fmtTime(e.t)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LiveBadge() {
  const gpsMode = useUi((s) => s.gpsMode);
  const live = useUi((s) => s.live);
  const trucks = useTrucks();
  if (gpsMode !== "live") return null;
  const now = Date.now();
  const n = trucks.filter((t) => {
    const f = liveFix(live, t);
    return f && now - f.ts < 15 * 60_000;
  }).length;
  return (
    <span className="hidden items-center gap-1 whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 lg:inline-flex">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> GPS live · {n}/{trucks.length}
    </span>
  );
}

const SEV_STYLE: Record<Severity, string> = { high: "bg-rose-500", medium: "bg-amber-400", info: "bg-sky-400" };

/** What needs the dispatcher's attention today (late deliveries, cold chain, stock, GPS, driver problems). */
function AlertsButton() {
  const [open, setOpen] = useState(false);
  const t = useMinute();
  const trucks = useTrucks();
  const gpsMode = useUi((s) => s.gpsMode);
  const live = useUi((s) => s.live);
  const confirmations = useUi((s) => s.confirmations);
  const select = useUi((s) => s.select);
  const alerts = useMemo(() => computeAlerts(trucks, t, { gpsMode, live, confirmations, now: Date.now() }), [trucks, t, gpsMode, live, confirmations]);
  const high = alerts.filter((a) => a.severity === "high").length;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button aria-label="Alerte" title="Alerte" onClick={() => setOpen(!open)} className={`relative flex h-9 items-center gap-1 rounded-xl border px-2 text-[12px] font-semibold transition ${high ? "border-rose-200 bg-rose-50 text-rose-700" : alerts.length ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-500"} ${open ? "ring-2 ring-blue-100" : ""}`}>
        <TriangleAlert size={14} /> {alerts.length}
      </button>
      {open && (
        <div className="panel-in absolute right-0 top-11 z-50 w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2 text-[12px] font-semibold text-slate-800">
            Alerte azi <span className="font-normal text-slate-400">· {high} importante</span>
          </div>
          <ul className="max-h-[440px] overflow-y-auto py-1">
            {alerts.length === 0 && <li className="px-3 py-4 text-center text-[12px] text-slate-400">Totul este în regulă.</li>}
            {alerts.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => {
                    if (a.select) select(a.select);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEV_STYLE[a.severity]}`} />
                  <span className="flex-1">
                    <span className="block text-[12px] font-medium text-slate-800">{a.title}</span>
                    <span className="block text-[11px] leading-snug text-slate-500">{a.detail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
