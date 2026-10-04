"use client";

import { Building2, MapPin, Package, Phone, Truck as TruckIcon, Warehouse, X } from "lucide-react";
import { INSTITUTION_BY_ID, PRODUCT_BY_ID, PRODUCTS, TRUCKS } from "@/lib/seed";
import { STATUS_LABEL, STATUS_TONE, fmtDur, fmtTime, isOnTime, stopStatus, truckState } from "@/lib/sim";
import { useMinute, useUi } from "@/lib/store";
import type { InstitutionType, Selection, StorageZone } from "@/lib/types";
import { Bar, Card, Chip, Row } from "./ui";

const TYPE_LABEL: Record<InstitutionType, string> = { kindergarten: "Kindergarten", school: "School", hospital: "Hospital", prison: "Penitentiary", social: "Social care" };
const ZONE_LABEL: Record<StorageZone | "office", string> = { cellar: "Underground depot", cold: "Cold room", dry: "Dry goods racks", office: "Office" };

export function DetailPanel() {
  const sel = useUi((s) => s.selection);
  const select = useUi((s) => s.select);
  if (!sel) return null;
  return (
    <Card className="pointer-events-auto w-[320px] max-w-[calc(100vw-32px)] overflow-hidden">
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-4">
        <button aria-label="Close" onClick={() => select(null)} className="float-right grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X size={14} />
        </button>
        <Body sel={sel} />
      </div>
    </Card>
  );
}

function Header({ icon, kicker, title, sub }: { icon: React.ReactNode; kicker: string; title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">{kicker}</div>
        <div className="truncate text-[15px] font-semibold text-slate-900">{title}</div>
        {sub && <div className="truncate text-[11px] text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

function Body({ sel }: { sel: NonNullable<Selection> }) {
  const t = useMinute();
  const select = useUi((s) => s.select);

  if (sel.kind === "truck") {
    const tr = TRUCKS.find((x) => x.id === sel.id)!;
    const st = truckState(tr, t);
    const next = tr.stops[st.stopIdx];
    const nextInst = next && INSTITUTION_BY_ID.get(next.institutionId);
    const load = tr.stops.reduce((a, s) => a + s.weightKg, 0);
    return (
      <>
        <Header icon={<TruckIcon size={20} />} kicker={`Truck · ${tr.region}`} title={tr.plate} sub={`${tr.driver} · ${tr.model}`} />
        <div className="mb-2 flex items-center gap-2">
          <Chip tone={STATUS_TONE[st.status]}>{STATUS_LABEL[st.status]}</Chip>
          <span className="truncate text-[11px] text-slate-500">
            {st.status === "loading" && `Dock D${tr.dock} · departs ${fmtTime(tr.departAt)}`}
            {(st.status === "driving" || st.status === "departing") && nextInst && `To ${nextInst.name}`}
            {st.status === "unloading" && nextInst && `At ${nextInst.name}`}
            {st.status === "parked" && `Loading starts ${fmtTime(tr.loadStart)}`}
            {(st.status === "returning" || st.status === "arriving") && `Back at ${fmtTime(tr.returnAt)}`}
            {st.status === "done" && `Returned ${fmtTime(tr.returnAt)}`}
          </span>
        </div>
        <Bar value={st.delivered / tr.stops.length} tone="green" />
        <div className="mb-2 mt-1 text-right text-[10.5px] text-slate-500">
          {st.delivered}/{tr.stops.length} stops delivered
        </div>
        <Row k="Load" v={`${load} kg / ${tr.capacityKg} kg`} />
        <Row k="Route" v={`${tr.totalKm} km · ${fmtTime(tr.departAt)}–${fmtTime(tr.returnAt)}`} />
        {next && st.status !== "done" && <Row k="Next ETA" v={`${fmtTime(next.arriveAt)} (${fmtDur(next.arriveAt - t)})`} />}
        <Row
          k="Driver"
          v={
            <a href={`tel:${tr.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-blue-600">
              <Phone size={11} /> {tr.phone}
            </a>
          }
        />
        <div className="mt-3 text-[11px] font-semibold text-slate-700">Stops</div>
        <ol className="mt-1 space-y-1">
          {tr.stops.map((s, i) => {
            const inst = INSTITUTION_BY_ID.get(s.institutionId)!;
            const ss = stopStatus(tr, i, t);
            return (
              <li key={s.id}>
                <button onClick={() => select({ kind: "institution", id: inst.id })} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-50">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${ss === "delivered" ? "bg-emerald-500 text-white" : ss === "unloading" ? "bg-amber-400 text-white" : ss === "next" ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] text-slate-800">{inst.name}</span>
                    <span className="block text-[10px] text-slate-400">
                      {inst.town} · {s.weightKg} kg
                    </span>
                  </span>
                  <span className={`text-[10.5px] tabular-nums ${isOnTime(s) ? "text-slate-500" : "text-rose-600"}`}>{fmtTime(s.arriveAt)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </>
    );
  }

  if (sel.kind === "institution") {
    const inst = INSTITUTION_BY_ID.get(sel.id)!;
    let found: { tr: (typeof TRUCKS)[number]; i: number } | null = null;
    TRUCKS.forEach((tr) => tr.stops.forEach((s, i) => s.institutionId === inst.id && (found = { tr, i })));
    const f = found as { tr: (typeof TRUCKS)[number]; i: number } | null;
    const stop = f?.tr.stops[f.i];
    const ss = f ? stopStatus(f.tr, f.i, t) : null;
    return (
      <>
        <Header icon={<Building2 size={20} />} kicker={TYPE_LABEL[inst.type]} title={inst.name} sub={inst.town} />
        {f && stop ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Chip tone={ss === "delivered" ? "green" : ss === "unloading" ? "amber" : "blue"}>{ss === "delivered" ? "Delivered" : ss === "unloading" ? "Unloading now" : ss === "next" ? "Truck on the way" : "Planned today"}</Chip>
              <span className="text-[11px] text-slate-500">{stop.orderNo}</span>
            </div>
            <Row k="Truck" v={<button className="text-blue-600" onClick={() => select({ kind: "truck", id: f.tr.id })}>{f.tr.plate}</button>} />
            <Row k="Planned arrival" v={fmtTime(stop.arriveAt)} />
            <Row k="Deliver before" v={<span className={isOnTime(stop) ? "" : "text-rose-600"}>{fmtTime(inst.windowEnd)}</span>} />
            <Row k="Ordered" v={`${stop.orderedDaysAgo} day${stop.orderedDaysAgo > 1 ? "s" : ""} ago (by phone → 1C)`} />
            <div className="mt-3 text-[11px] font-semibold text-slate-700">Order · {stop.weightKg} kg</div>
            <ul className="mt-1 divide-y divide-slate-100">
              {stop.lines.map((l) => {
                const p = PRODUCT_BY_ID.get(l.productId)!;
                return (
                  <li key={l.productId} className="flex items-center gap-2 py-1.5 text-[11.5px]">
                    <span className="h-3 w-3 rounded" style={{ background: p.color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }} />
                    <span className="flex-1 text-slate-700">{p.name}</span>
                    <span className="tabular-nums text-slate-500">
                      {l.qty} {p.unit}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-[12px] text-slate-500">No delivery scheduled today.</p>
        )}
        <div className="mt-3 flex items-center gap-1 text-[10.5px] text-slate-400">
          <MapPin size={11} /> {inst.pos[1].toFixed(4)}, {inst.pos[0].toFixed(4)}
        </div>
      </>
    );
  }

  if (sel.kind === "dock") {
    const trucks = TRUCKS.filter((x) => x.dock === sel.id);
    const now = trucks.find((x) => t >= x.loadStart && t < x.departAt);
    return (
      <>
        <Header icon={<Warehouse size={20} />} kicker="Front entrance" title={`Dock D${sel.id}`} sub={now ? `Loading ${now.plate}` : "Free"} />
        {now && (
          <>
            <Bar value={truckState(now, t).progress} tone="amber" />
            <div className="mb-2 mt-1 text-right text-[10.5px] text-slate-500">departs {fmtTime(now.departAt)}</div>
          </>
        )}
        <div className="text-[11px] font-semibold text-slate-700">Today at this dock</div>
        {trucks.map((x) => (
          <Row key={x.id} k={`${fmtTime(x.loadStart)}–${fmtTime(x.departAt)}`} v={<button className="text-blue-600" onClick={() => select({ kind: "truck", id: x.id })}>{x.plate}</button>} />
        ))}
      </>
    );
  }

  if (sel.kind === "zone") {
    if (sel.id === "office") {
      return (
        <>
          <Header icon={<Building2 size={20} />} kicker="Warehouse" title="Office" sub="Dispatch & order entry (1C)" />
          <p className="text-[12px] text-slate-500">Orders taken by phone are entered in 1C here. Once 1C is connected, they will appear in DepotOps automatically.</p>
        </>
      );
    }
    const items = PRODUCTS.filter((p) => p.zone === sel.id);
    return (
      <>
        <Header icon={<Package size={20} />} kicker="Storage zone" title={ZONE_LABEL[sel.id]} sub={`${items.length} products`} />
        <StockList items={items} />
      </>
    );
  }

  return (
    <>
      <Header icon={<Warehouse size={20} />} kicker="Chișinău" title="Main warehouse" sub="Front entrance · 6 docks" />
      <Row k="Trucks" v={TRUCKS.length} />
      <Row k="Products" v={PRODUCTS.length} />
      <button onClick={() => useUi.getState().setView("warehouse")} className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-[12px] font-medium text-white hover:bg-blue-700">
        Open 3D warehouse
      </button>
    </>
  );
}

export function StockList({ items }: { items: typeof PRODUCTS }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((p) => {
        const low = p.stock < p.min;
        return (
          <li key={p.id} className="py-1.5">
            <div className="flex items-center gap-2 text-[11.5px]">
              <span className="h-3 w-3 rounded" style={{ background: p.color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }} />
              <span className="flex-1 text-slate-700">{p.name}</span>
              <span className="tabular-nums text-slate-800">
                {p.stock.toLocaleString("ro-MD")} {p.unit}
              </span>
              <Chip tone={low ? "amber" : "green"}>{low ? "Low" : "OK"}</Chip>
            </div>
            <Bar value={p.stock / (p.min * 3)} tone={low ? "amber" : "blue"} className="ml-5 mt-1" />
          </li>
        );
      })}
    </ul>
  );
}
