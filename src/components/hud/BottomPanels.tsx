"use client";

import { Check, ChevronRight, ClipboardList, PackageCheck, PackageOpen, Phone, Truck as TruckIcon } from "lucide-react";
import { useState } from "react";
import { DOCK_COUNT, INSTITUTION_BY_ID, PIPELINE, PRODUCTS, TRUCKS } from "@/lib/seed";
import { STATUS_LABEL, STATUS_TONE, fmtTime, truckState } from "@/lib/sim";
import { useMinute, useUi } from "@/lib/store";
import { StockList } from "./DetailPanel";
import { Bar, Card, Chip } from "./ui";

/** Tracking strip for the selected truck (or the most interesting one right now). */
export function TrackingPanel() {
  const t = useMinute();
  const sel = useUi((s) => s.selection);
  const select = useUi((s) => s.select);
  const truck =
    (sel?.kind === "truck" && TRUCKS.find((x) => x.id === sel.id)) ||
    TRUCKS.find((x) => ["loading", "departing", "driving", "unloading"].includes(truckState(x, t).status)) ||
    TRUCKS[0];
  const st = truckState(truck, t);
  const idx = Math.min(st.stopIdx, truck.stops.length - 1);
  const stop = truck.stops[idx];
  const inst = INSTITUTION_BY_ID.get(stop.institutionId)!;
  const prevLeave = idx === 0 ? truck.departAt : truck.stops[idx - 1].leaveAt;

  const steps = [
    { icon: Phone, label: "Ordered", time: `${stop.orderedDaysAgo}d ago`, done: true },
    { icon: ClipboardList, label: "Picked", time: fmtTime(truck.loadStart - 25), done: t >= truck.loadStart - 25 },
    { icon: PackageCheck, label: st.status === "loading" ? `Loading ${Math.round(st.progress * 100)}%` : "Loaded", time: fmtTime(truck.departAt), done: t >= truck.departAt, active: st.status === "loading" },
    { icon: TruckIcon, label: "In transit", time: fmtTime(prevLeave), done: t >= stop.arriveAt, active: t >= prevLeave && t < stop.arriveAt },
    { icon: PackageOpen, label: t >= stop.arriveAt && t < stop.leaveAt ? "Unloading" : "Delivered", time: `${t >= stop.leaveAt ? "" : "ETA "}${fmtTime(stop.leaveAt)}`, done: t >= stop.leaveAt, active: t >= stop.arriveAt && t < stop.leaveAt },
  ];

  return (
    <Card className="pointer-events-auto hidden w-[640px] max-w-[calc(100vw-32px)] p-3 sm:block">
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="flex items-center gap-1.5 font-semibold text-slate-800">
          <TruckIcon size={14} className="text-blue-600" /> Delivery tracking
        </span>
        <span className="text-[10.5px] text-slate-400">
          {truck.plate} · stop {idx + 1}/{truck.stops.length}
        </span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ol className="flex flex-1 items-start">
          {steps.map((s, i) => (
            <li key={s.label} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && <span className={`absolute right-1/2 top-3.5 h-0.5 w-full ${s.done || s.active ? "bg-blue-500" : "bg-slate-200"}`} />}
              <span className={`relative z-10 grid h-7 w-7 place-items-center rounded-full ring-4 ring-white ${s.done ? "bg-blue-600 text-white" : s.active ? "bg-blue-100 text-blue-700 ring-blue-50" : "bg-slate-100 text-slate-400"}`}>{s.done ? <Check size={13} /> : <s.icon size={13} />}</span>
              <span className="mt-1 text-[10.5px] font-medium text-slate-700">{s.label}</span>
              <span className="text-[9.5px] text-slate-400">{s.time}</span>
            </li>
          ))}
        </ol>
        <button onClick={() => select({ kind: "institution", id: inst.id })} className="flex w-full items-center gap-2 rounded-xl bg-slate-50 p-2 text-left hover:bg-blue-50 sm:w-[220px]">
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold text-slate-500">{stop.orderNo}</span>
            <span className="block truncate text-[11.5px] font-medium text-slate-800">{inst.name}</span>
            <span className="block truncate text-[10px] text-slate-400">
              {inst.town} · {stop.weightKg} kg
            </span>
          </span>
          <ChevronRight size={14} className="text-slate-400" />
        </button>
      </div>
    </Card>
  );
}

type Tab = "trucks" | "docks" | "stock" | "orders";

export function FleetPanel() {
  const [tab, setTab] = useState<Tab>("trucks");
  const t = useMinute();
  const select = useUi((s) => s.select);
  const low = PRODUCTS.filter((p) => p.stock < p.min).length;
  const tabs: [Tab, string][] = [
    ["trucks", `Trucks ${TRUCKS.length}`],
    ["docks", `Docks ${DOCK_COUNT}`],
    ["stock", `Stock${low ? ` · ${low}⚠` : ""}`],
    ["orders", "Orders"],
  ];
  return (
    <Card className="pointer-events-auto w-[400px] max-w-[calc(100vw-32px)] overflow-hidden">
      <div className="flex gap-1 border-b border-slate-100 p-1.5">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium ${tab === k ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="max-h-[230px] overflow-y-auto px-2 py-1">
        {tab === "trucks" &&
          TRUCKS.map((tr) => {
            const st = truckState(tr, t);
            return (
              <button key={tr.id} onClick={() => select({ kind: "truck", id: tr.id })} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-slate-50">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tr.color }} />
                <span className="w-[62px] shrink-0 text-[11.5px] font-semibold text-slate-800">{tr.plate}</span>
                <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-500">{tr.region}</span>
                <Chip tone={STATUS_TONE[st.status]}>{STATUS_LABEL[st.status]}</Chip>
                <span className="w-[52px] shrink-0">
                  <Bar value={st.delivered / tr.stops.length} tone="green" />
                  <span className="block text-right text-[9.5px] tabular-nums text-slate-400">
                    {st.delivered}/{tr.stops.length}
                  </span>
                </span>
              </button>
            );
          })}
        {tab === "docks" &&
          Array.from({ length: DOCK_COUNT }, (_, i) => {
            const now = TRUCKS.find((x) => x.dock === i + 1 && t >= x.loadStart && t < x.departAt);
            const nextT = TRUCKS.filter((x) => x.dock === i + 1 && x.loadStart > t).sort((a, b) => a.loadStart - b.loadStart)[0];
            return (
              <button key={i} onClick={() => select({ kind: "dock", id: i + 1 })} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-slate-50">
                <span className="w-8 text-[11.5px] font-semibold text-slate-800">D{i + 1}</span>
                <span className="flex-1 text-[11px] text-slate-500">{now ? now.plate : nextT ? `Next: ${nextT.plate} at ${fmtTime(nextT.loadStart)}` : "No trucks planned"}</span>
                {now ? (
                  <>
                    <Chip tone="amber">Loading</Chip>
                    <Bar value={truckState(now, t).progress} tone="amber" className="w-12" />
                  </>
                ) : (
                  <Chip tone="green">Free</Chip>
                )}
              </button>
            );
          })}
        {tab === "stock" && <StockList items={[...PRODUCTS].sort((a, b) => a.stock / a.min - b.stock / b.min)} />}
        {tab === "orders" && (
          <div className="py-1">
            <p className="px-1.5 pb-2 text-[11px] text-slate-500">Orders taken by phone and entered in 1C, delivered 1–3 days later.</p>
            {PIPELINE.map((p) => (
              <div key={p.label} className="flex items-center gap-2 px-1.5 py-1.5 text-[11.5px]">
                <span className="w-20 font-medium text-slate-700">{p.label}</span>
                <Bar value={p.orders / 160} className="flex-1" />
                <span className="w-24 text-right tabular-nums text-slate-500">
                  {p.orders} orders · {(p.kg / 1000).toFixed(1)} t
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
