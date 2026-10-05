"use client";

import { ArrowUpDown, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { INSTITUTION_BY_ID } from "@/lib/seed";
import { fmtTime, isOnTime, stopStatus } from "@/lib/sim";
import { useMinute, useTrucks, useUi } from "@/lib/store";
import type { InstitutionType, StopStatus } from "@/lib/types";
import { TruckBadge } from "./hud/DetailPanel";
import { Kpis } from "./hud/Kpis";
import { Card, Chip, type Tone } from "./hud/ui";

const TYPE_LABEL: Record<InstitutionType, string> = { kindergarten: "Grădiniță", school: "Școală", hospital: "Spital", prison: "Penitenciar", social: "Asistență socială" };
const STATUS: Record<StopStatus, [string, Tone]> = {
  planned: ["Planificat", "gray"],
  next: ["Mașina e pe drum", "blue"],
  unloading: ["Se descarcă", "amber"],
  delivered: ["Livrat", "green"],
};
type Filter = "all" | StopStatus | "late";
const FILTERS: [Filter, string][] = [
  ["all", "Toate"],
  ["planned", "Planificate"],
  ["next", "Pe drum"],
  ["unloading", "Se descarcă"],
  ["delivered", "Livrate"],
  ["late", "După 18:00"],
];
type SortKey = "eta" | "truck" | "town" | "kg";

/** Every delivery of the day in one table, filterable by status, truck and text. */
export function DeliveriesView() {
  const t = useMinute();
  const trucks = useTrucks();
  const select = useUi((s) => s.select);
  const setView = useUi((s) => s.setView);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [truckId, setTruckId] = useState("");
  const [sort, setSort] = useState<SortKey>("eta");

  const rows = useMemo(
    () =>
      trucks.flatMap((tr) =>
        tr.stops.map((s, i) => {
          const inst = INSTITUTION_BY_ID.get(s.institutionId)!;
          return { tr, s, i, inst, status: stopStatus(tr, i, t), late: !isOnTime(s) };
        }),
      ),
    [trucks, t],
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, planned: 0, next: 0, unloading: 0, delivered: 0, late: 0 };
    rows.forEach((r) => {
      c[r.status]++;
      if (r.late) c.late++;
    });
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (filter === "all" || (filter === "late" ? r.late : r.status === filter)) &&
        (!truckId || r.tr.id === truckId) &&
        (!n || `${r.inst.name} ${r.inst.town} ${r.s.orderNo}`.toLowerCase().includes(n)),
    );
    const by: Record<SortKey, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      eta: (a, b) => a.s.arriveAt - b.s.arriveAt,
      truck: (a, b) => a.tr.number - b.tr.number || a.i - b.i,
      town: (a, b) => a.inst.town.localeCompare(b.inst.town, "ro") || a.s.arriveAt - b.s.arriveAt,
      kg: (a, b) => b.s.weightKg - a.s.weightKg,
    };
    return list.sort(by[sort]);
  }, [rows, q, filter, truckId, sort]);

  const SortBtn = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <button onClick={() => setSort(k)} className={`inline-flex items-center gap-1 ${sort === k ? "text-blue-700" : "hover:text-slate-700"} ${className}`}>
      {children}
      <ArrowUpDown size={11} className={sort === k ? "opacity-100" : "opacity-30"} />
    </button>
  );

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#eef2fb]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 p-3 sm:p-4">
        <Kpis />
        <Card className="panel-in overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută instituție, localitate sau nr. comandă…" className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-[12px] outline-none focus:border-blue-300 focus:bg-white" />
            </div>
            <select value={truckId} onChange={(e) => setTruckId(e.target.value)} aria-label="Mașina" className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-blue-300">
              <option value="">Toate mașinile</option>
              {trucks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.label} · {tr.region}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 py-2">
            {FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition ${filter === k ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"}`}>
                {label} <span className={`ml-0.5 tabular-nums ${filter === k ? "text-blue-100" : "text-slate-400"}`}>{counts[k]}</span>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12px]">
              <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2">
                    <SortBtn k="eta">Sosire</SortBtn>
                  </th>
                  <th className="px-3 py-2">Instituția</th>
                  <th className="px-3 py-2">
                    <SortBtn k="town">Localitatea</SortBtn>
                  </th>
                  <th className="px-3 py-2">
                    <SortBtn k="truck">Mașina</SortBtn>
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortBtn k="kg" className="justify-end">
                      Greutate
                    </SortBtn>
                  </th>
                  <th className="px-3 py-2">Comanda</th>
                  <th className="px-3 py-2">Starea</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map(({ tr, s, i, inst, status, late }) => (
                  <tr key={s.id} className="group transition-colors hover:bg-blue-50/50">
                    <td className={`px-3 py-2 tabular-nums ${late ? "font-medium text-rose-600" : "text-slate-700"}`}>{fmtTime(s.arriveAt)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{inst.name}</div>
                      <div className="text-[10.5px] text-slate-400">{TYPE_LABEL[inst.type]}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{inst.town}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => select({ kind: "truck", id: tr.id })} className="inline-flex items-center gap-1.5 text-slate-700 hover:text-blue-700">
                        <TruckBadge truck={tr} size={18} /> <span className="whitespace-nowrap">{tr.label}</span>
                        {tr.plate && <span className="whitespace-nowrap text-[10.5px] text-slate-400">{tr.plate}</span>}
                        <span className="text-[10.5px] text-slate-400">· {i + 1}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{s.weightKg} kg</td>
                    <td className="px-3 py-2 text-[11px] text-slate-500">{s.orderNo}</td>
                    <td className="px-3 py-2">
                      <Chip tone={STATUS[status][1]}>{STATUS[status][0]}</Chip>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        aria-label="Arată pe hartă"
                        title="Arată pe hartă"
                        onClick={() => {
                          setView("map");
                          select({ kind: "institution", id: inst.id });
                        }}
                        className="rounded-lg p-1.5 text-slate-400 opacity-60 transition hover:bg-white hover:text-blue-700 group-hover:opacity-100"
                      >
                        <MapPin size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                      Nicio livrare pentru acest filtru.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
