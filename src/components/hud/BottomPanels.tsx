"use client";

import { Check, ChevronRight, ClipboardList, Minus, PackageCheck, PackageOpen, Phone, Plus, Truck as TruckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { demandByProduct } from "@/lib/alerts";
import { dayLabel, nextWorkday } from "@/lib/dates";
import { orderKg } from "@/lib/planner";
import { INSTITUTION_BY_ID, MAX_TRUCKS, PRODUCTS } from "@/lib/seed";
import { loadingPlace, PLACE_LABEL, STATUS_LABEL, STATUS_TONE, fmtTime, truckState } from "@/lib/sim";
import { levelOf } from "@/lib/stock";
import { useMinute, useTrucks, useUi } from "@/lib/store";
import { StockList, TruckBadge } from "./DetailPanel";
import { Bar, Card, Chip } from "./ui";

/** Tracking strip for the selected truck (or the most interesting one right now). */
export function TrackingPanel() {
  const t = useMinute();
  const trucks = useTrucks();
  const sel = useUi((s) => s.selection);
  const select = useUi((s) => s.select);
  const withStops = trucks.filter((x) => x.stops.length > 0);
  const truck =
    (sel?.kind === "truck" && withStops.find((x) => x.id === sel.id)) ||
    withStops.find((x) => ["loading", "departing", "driving", "unloading"].includes(truckState(x, t).status)) ||
    withStops[0];
  if (!truck) return null;
  const st = truckState(truck, t);
  const idx = Math.min(st.stopIdx, truck.stops.length - 1);
  const stop = truck.stops[idx];
  const inst = INSTITUTION_BY_ID.get(stop.institutionId)!;
  const prevLeave = idx === 0 ? truck.departAt : truck.stops[idx - 1].leaveAt;

  const steps = [
    { icon: Phone, label: "Comandat", time: `acum ${stop.orderedDaysAgo} z`, done: true },
    { icon: ClipboardList, label: "Pregătit", time: fmtTime(truck.loadStart - 25), done: t >= truck.loadStart - 25 },
    { icon: PackageCheck, label: st.status === "loading" ? `Încărcare ${Math.round(st.progress * 100)}%` : "Încărcat", time: fmtTime(truck.departAt), done: t >= truck.departAt, active: st.status === "loading" },
    { icon: TruckIcon, label: "Pe drum", time: fmtTime(prevLeave), done: t >= stop.arriveAt, active: t >= prevLeave && t < stop.arriveAt },
    { icon: PackageOpen, label: t >= stop.arriveAt && t < stop.leaveAt ? "Descărcare" : "Livrat", time: `${t >= stop.leaveAt ? "" : "~"}${fmtTime(stop.leaveAt)}`, done: t >= stop.leaveAt, active: t >= stop.arriveAt && t < stop.leaveAt },
  ];

  return (
    <Card className="pointer-events-auto hidden w-[640px] max-w-[calc(100vw-32px)] p-3 sm:block">
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="flex items-center gap-1.5 font-semibold text-slate-800">
          <TruckIcon size={14} className="text-blue-600" /> Urmărirea livrării
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
          <TruckBadge truck={truck} size={16} /> {truck.label} · oprirea {idx + 1}/{truck.stops.length}
        </span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ol className="flex flex-1 items-start">
          {steps.map((s, i) => (
            <li key={i} className="relative flex flex-1 flex-col items-center text-center">
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
  const trucks = useTrucks();
  const addTruck = useUi((s) => s.addTruck);
  const removeLastTruck = useUi((s) => s.removeLastTruck);
  const fleetSize = useUi((s) => s.fleet.length);
  const select = useUi((s) => s.select);
  const levels = useUi((s) => s.levels);
  const demand = useMemo(() => demandByProduct(trucks), [trucks]);
  const low = PRODUCTS.filter((p) => levelOf(levels, p.id) < p.min || (demand.get(p.id) ?? 0) > levelOf(levels, p.id)).length;
  const tabs: [Tab, string][] = [
    ["trucks", `Mașini ${trucks.length}`],
    ["docks", "Încărcare"],
    ["stock", `Stoc${low ? ` · ${low}⚠` : ""}`],
    ["orders", "Comenzi"],
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
        {tab === "trucks" && (
          <>
            {trucks.map((tr) => {
              const st = truckState(tr, t);
              return (
                <button key={tr.id} onClick={() => select({ kind: "truck", id: tr.id })} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-slate-50">
                  <TruckBadge truck={tr} />
                  <span className="w-[66px] shrink-0 leading-tight">
                    <span className="block text-[11.5px] font-semibold text-slate-800">{tr.label}</span>
                    <span className="block text-[9.5px] text-slate-400">{tr.plate || "—"}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-500">{tr.region}</span>
                  {!tr.gpsOk && (
                    <span title="Tracker-ul GPS nu a transmis niciodată" className="shrink-0 rounded bg-rose-50 px-1 text-[9.5px] font-semibold text-rose-600 ring-1 ring-rose-200">
                      fără GPS
                    </span>
                  )}
                  <Chip tone={STATUS_TONE[st.status]}>{STATUS_LABEL[st.status]}</Chip>
                  <span className="w-[44px] shrink-0">
                    <Bar value={st.delivered / tr.stops.length} tone="green" />
                    <span className="block text-right text-[9.5px] tabular-nums text-slate-400">
                      {st.delivered}/{tr.stops.length}
                    </span>
                  </span>
                </button>
              );
            })}
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-1.5 pb-1 pt-2">
              <span className="text-[10.5px] text-slate-400">Traseele se replanifică automat.</span>
              <span className="flex gap-1">
                <button disabled={fleetSize <= 1} onClick={removeLastTruck} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                  <Minus size={12} /> Elimină
                </button>
                <button disabled={fleetSize >= MAX_TRUCKS} onClick={addTruck} className="flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-40">
                  <Plus size={12} /> Adaugă mașină
                </button>
              </span>
            </div>
          </>
        )}
        {tab === "docks" &&
          (["beci", "rampa"] as const).map((place) => {
            const now = trucks.find((x) => loadingPlace(x, t) === place);
            const start = (x: (typeof trucks)[number]) => (place === "beci" ? x.beci?.from : x.ramp.from);
            const nextT = trucks.filter((x) => x.stops.length && (start(x) ?? -1) > t).sort((a, b) => (start(a) ?? 0) - (start(b) ?? 0))[0];
            const st = now && truckState(now, t);
            const progress = now && st ? (place === "beci" ? (t - now.beci!.from) / (now.beci!.to - now.beci!.from) : (t - now.ramp.from) / (now.ramp.to - now.ramp.from)) : 0;
            return (
              <button key={place} onClick={() => select({ kind: "dock", id: place })} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-left hover:bg-slate-50">
                <span className="w-14 text-[11.5px] font-semibold text-slate-800">{place === "beci" ? "Beci" : "Rampa"}</span>
                <span className="flex-1 text-[11px] text-slate-500">{now ? `${now.label} · ${PLACE_LABEL[place]}` : nextT ? `Următoarea: ${nextT.label} la ${fmtTime(start(nextT)!)}` : "Nicio mașină planificată"}</span>
                {now ? (
                  <>
                    <Chip tone="amber">Se încarcă</Chip>
                    <Bar value={progress} tone="amber" className="w-12" />
                  </>
                ) : (
                  <Chip tone="green">Liber</Chip>
                )}
              </button>
            );
          })}
        {tab === "stock" && <StockList demand={demand} items={[...PRODUCTS].sort((a, b) => (demand.get(b.id) ?? 0) / Math.max(1, levelOf(levels, b.id)) - (demand.get(a.id) ?? 0) / Math.max(1, levelOf(levels, a.id)) || levelOf(levels, a.id) / a.min - levelOf(levels, b.id) / b.min)} />}
        {tab === "orders" && <OrdersSummary />}
      </div>
    </Card>
  );
}

/** Registered orders for today and the next delivery days (opens the Comenzi page). */
function OrdersSummary() {
  const day = useUi((s) => s.day);
  const orders = useUi((s) => s.orders);
  const setView = useUi((s) => s.setView);
  const setWorkDate = useUi((s) => s.setWorkDate);
  const days = [day, nextWorkday(day), nextWorkday(nextWorkday(day))];
  const rows = days.map((d) => {
    const list = (orders[d] ?? []).filter((o) => o.status !== "anulata");
    return { d, n: list.length, kg: list.reduce((a, o) => a + orderKg(o), 0) };
  });
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="py-1">
      <p className="px-1.5 pb-2 text-[11px] text-slate-500">Comenzi înregistrate (telefon), livrate în zilele următoare.</p>
      {rows.map((r) => (
        <button
          key={r.d}
          onClick={() => {
            setWorkDate(r.d);
            setView("orders");
          }}
          className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-[11.5px] hover:bg-slate-50"
        >
          <span className="w-24 font-medium text-slate-700">{dayLabel(r.d, day)}</span>
          <Bar value={r.n / max} className="flex-1" />
          <span className="w-28 text-right tabular-nums text-slate-500">
            {r.n} comenzi · {(r.kg / 1000).toFixed(1)} t
          </span>
        </button>
      ))}
    </div>
  );
}
