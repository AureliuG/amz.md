"use client";

import { useMemo, useState } from "react";
import { DELIVER_BY, INSTITUTION_BY_ID } from "@/lib/seed";
import { STATUS_LABEL, STATUS_TONE, fmtTime, truckState } from "@/lib/sim";
import { DAY_END, DAY_START, useMinute, useTrucks, useUi } from "@/lib/store";
import type { Truck } from "@/lib/types";
import { TruckBadge } from "./hud/DetailPanel";
import { Kpis } from "./hud/Kpis";
import { Card, Chip } from "./hud/ui";

type Kind = "load" | "drive" | "unload" | "return";
const KIND: Record<Kind, { label: string; color: string }> = {
  load: { label: "Încărcare", color: "#f59e0b" },
  drive: { label: "Pe drum", color: "#3b82f6" },
  unload: { label: "Descărcare", color: "#10b981" },
  return: { label: "Întoarcere", color: "#8b5cf6" },
};

interface Seg {
  kind: Kind;
  from: number;
  to: number;
  title: string;
  sub: string;
}

function segments(tr: Truck): Seg[] {
  const out: Seg[] = [{ kind: "load", from: tr.loadStart, to: tr.departAt, title: `Încărcare la rampa R${tr.dock}`, sub: `${tr.stops.reduce((a, s) => a + s.weightKg, 0)} kg` }];
  let prev = tr.departAt;
  tr.stops.forEach((s, i) => {
    const inst = INSTITUTION_BY_ID.get(s.institutionId)!;
    out.push({ kind: "drive", from: prev, to: s.arriveAt, title: `Spre ${inst.name}`, sub: `${Math.round(s.distanceKm)} km` });
    out.push({ kind: "unload", from: s.arriveAt, to: s.leaveAt, title: `${i + 1}. ${inst.name}`, sub: `${inst.town} · ${s.weightKg} kg` });
    prev = s.leaveAt;
  });
  out.push({ kind: "return", from: prev, to: tr.returnAt, title: "Întoarcere la depozit", sub: `sosire ${fmtTime(tr.returnAt)}` });
  return out;
}

const span = DAY_END - DAY_START;
const pct = (m: number) => `${((m - DAY_START) / span) * 100}%`;
const HOURS = Array.from({ length: Math.floor(DAY_END / 60) - Math.ceil(DAY_START / 60) + 1 }, (_, i) => Math.ceil(DAY_START / 60) + i);

/** The day as a timeline: one row per truck, with loading, driving, unloading and return. */
export function PlanningView() {
  const t = useMinute();
  const trucks = useTrucks();
  const select = useUi((s) => s.select);
  const selection = useUi((s) => s.selection);
  const segs = useMemo(() => trucks.map(segments), [trucks]);
  const [tip, setTip] = useState<{ x: number; y: number; seg: Seg; truck: Truck } | null>(null);

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#eef2fb]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 p-3 sm:p-4">
        <Kpis />
        <Card className="panel-in overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-[14px] font-semibold text-slate-900">Programul zilei</div>
              <div className="text-[11px] text-slate-500">Fiecare rând este o mașină. Linia albastră arată ora curentă.</div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
              {(Object.keys(KIND) as Kind[]).map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND[k].color }} />
                  {KIND[k].label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-0 border-l-2 border-dashed border-rose-400" /> Termen 18:00
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* hour axis */}
              <div className="grid grid-cols-[220px_1fr] border-b border-slate-100 bg-slate-50/70">
                <div className="px-4 py-1.5 text-[10.5px] font-semibold text-slate-500">Mașina</div>
                <div className="relative mr-6 h-7">
                  {HOURS.map((h) => (
                    <span key={h} className="absolute top-1.5 -translate-x-1/2 text-[10px] tabular-nums text-slate-400" style={{ left: pct(h * 60) }}>
                      {String(h).padStart(2, "0")}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative" onMouseLeave={() => setTip(null)}>
                {trucks.map((tr, r) => {
                  const st = truckState(tr, t);
                  const active = selection?.kind === "truck" && selection.id === tr.id;
                  return (
                    <div key={tr.id} className={`grid grid-cols-[220px_1fr] border-b border-slate-100 transition-colors ${active ? "bg-blue-50/70" : "hover:bg-slate-50/70"}`}>
                      <button onClick={() => select({ kind: "truck", id: tr.id })} className="flex items-center gap-2 px-4 py-2 text-left">
                        <TruckBadge truck={tr} size={22} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold text-slate-800">{tr.label}</span>
                          <span className="block truncate text-[10.5px] text-slate-400">{tr.region}</span>
                        </span>
                        <Chip tone={STATUS_TONE[st.status]}>{STATUS_LABEL[st.status]}</Chip>
                      </button>
                      <div className="relative mr-6 h-12">
                        {/* hour grid */}
                        {HOURS.map((h) => (
                          <span key={h} className="absolute inset-y-0 w-px bg-slate-100" style={{ left: pct(h * 60) }} />
                        ))}
                        {segs[r].map((s, i) => {
                          const past = s.to <= t;
                          const current = s.from <= t && t < s.to;
                          return (
                            <span
                              key={i}
                              onClick={() => select({ kind: "truck", id: tr.id })}
                              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, seg: s, truck: tr })}
                              className={`absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-[4px] ring-2 ring-white transition-opacity ${s.kind === "unload" ? "h-5" : "h-3"} ${current ? "shadow-[0_0_0_3px_rgba(47,107,255,0.25)]" : ""}`}
                              style={{ left: pct(s.from), width: `max(3px, calc(${pct(s.to)} - ${pct(s.from)}))`, background: KIND[s.kind].color, opacity: past || current ? 1 : 0.4 }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {/* deadline + now lines over the timeline column */}
                <div className="pointer-events-none absolute inset-y-0 left-[220px] right-6">
                  <span className="absolute inset-y-0 border-l-2 border-dashed border-rose-300" style={{ left: pct(DELIVER_BY) }} />
                  <span className="absolute inset-y-0 w-0.5 bg-[#2f6bff]" style={{ left: pct(t) }}>
                    <span className="absolute -top-0 left-1/2 -translate-x-1/2 rounded-b-md bg-[#2f6bff] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">{fmtTime(t)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {tip && (
        <div className="pointer-events-none fixed z-50 w-[240px] rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl" style={{ left: Math.min(tip.x + 14, window.innerWidth - 256), top: tip.y + 14 }}>
          <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-500">
            <span className="h-2 w-2 rounded-sm" style={{ background: KIND[tip.seg.kind].color }} />
            {KIND[tip.seg.kind].label} · {tip.truck.label}
          </div>
          <div className="text-[12px] font-medium leading-snug text-slate-800">{tip.seg.title}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {fmtTime(tip.seg.from)}–{fmtTime(tip.seg.to)} · {tip.seg.sub}
          </div>
        </div>
      )}
    </div>
  );
}
