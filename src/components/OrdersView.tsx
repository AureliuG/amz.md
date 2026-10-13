"use client";

import { Ban, Building2, CalendarDays, Check, ChevronRight, ClipboardList, Copy, FlaskConical, PackageCheck, Phone, Plus, Receipt, RotateCcw, Route, Search, Trash2, Truck as TruckIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { dayLabel, longDate, nextWorkday, shortDate, weekdayShort } from "@/lib/dates";
import { placements, STAGE, stageOf, type Stage } from "@/lib/orders";
import { orderKg } from "@/lib/planner";
import { INSTITUTION_BY_ID, INSTITUTIONS, normalize, PRODUCT_BY_ID, PRODUCTS } from "@/lib/seed";
import { fmtTime } from "@/lib/sim";
import { fmtQty, unitLabel, ZONE_SHORT } from "@/lib/stock";
import { instName, lastOrderOf, useDay, useMinute, useUi } from "@/lib/store";
import type { Institution, InstitutionType, Order, OrderLine, Product } from "@/lib/types";
import { TruckBadge } from "./hud/DetailPanel";
import { DayPicker } from "./hud/DayPicker";
import { Field, Modal } from "./hud/Modal";
import { Card, Chip } from "./hud/ui";
import { useOutlook } from "./StockView";

const TYPE_LABEL: Record<InstitutionType, string> = { kindergarten: "Grădiniță", school: "Școală", hospital: "Spital", prison: "Penitenciar", social: "Asistență socială" };
const fmtCreated = (ms: number) => new Date(ms).toLocaleString("ro-MD", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
type Filter = "toate" | Stage;

/** Opens the new-order form from anywhere (top bar, keyboard). */
export const openNewOrder = () => window.dispatchEvent(new Event("np-new-order"));

export function OrdersView() {
  const day = useUi((s) => s.day);
  const date = useUi((s) => s.workDate);
  const setDate = useUi((s) => s.setWorkDate);
  const r = useDay(date);
  const t = useMinute();
  const conf = useUi((s) => s.confirmations);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("toate");
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    void useUi.getState().fetchDay(date);
  }, [date]);
  useEffect(() => {
    const open = () => setNewOpen(true);
    window.addEventListener("np-new-order", open);
    return () => window.removeEventListener("np-new-order", open);
  }, []);

  const place = useMemo(() => placements(r), [r]);
  const all = useMemo(() => (r.demo ? r.orders : (useUi.getState().orders[date] ?? [])), [r, date]);
  const rows = useMemo(
    () =>
      all
        .map((o) => {
          const p = place.get(o.id);
          return { o, p, stage: stageOf(o, p, r, { today: day, t, conf }), inst: INSTITUTION_BY_ID.get(o.institutionId), kg: orderKg(o) };
        })
        .sort((a, b) => (a.o.status === "anulata" ? 1 : 0) - (b.o.status === "anulata" ? 1 : 0) || b.o.createdAt - a.o.createdAt),
    [all, place, r, day, t, conf],
  );
  const counts = useMemo(() => {
    const m = new Map<Filter, number>([["toate", rows.length]]);
    rows.forEach((x) => m.set(x.stage, (m.get(x.stage) ?? 0) + 1));
    return m;
  }, [rows]);
  const shown = useMemo(() => {
    const n = normalize(q);
    return rows.filter((x) => (filter === "toate" || x.stage === filter) && (!n || normalize(`${x.o.no} ${x.inst?.name ?? ""} ${x.inst?.town ?? ""} ${x.inst?.code ?? ""}`).includes(n)));
  }, [rows, q, filter]);
  const open = rows.find((x) => x.o.id === openId);

  const filters: Filter[] = ["toate", "neplanificata", "planificata", "incarcata", "pe-drum", "livrata", "livrata-plan", "problema", "neconfirmata", "anulata"];

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#eef2fb]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 p-3 sm:p-4">
        <Card className="panel-in p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[16px] font-semibold text-slate-900">
                <ClipboardList size={18} className="text-blue-600" /> Comenzi · {dayLabel(date, day)}
              </div>
              <div className="text-[12px] text-slate-500">
                {longDate(date)}. Comenzile se primesc la telefon cu o zi sau mai multe înainte și se înregistrează aici. Livrare până la 18:00.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DayPicker date={date} today={day} onChange={setDate} />
              <button onClick={() => setNewOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-blue-700">
                <Plus size={15} /> Comandă nouă
              </button>
            </div>
          </div>
          <CycleBar date={date} />
        </Card>

        {r.demo && <DemoBanner date={date} onNew={() => setNewOpen(true)} />}
        <DaySummary date={date} />

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <div className="relative min-w-[220px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută instituție, localitate, cod sau nr. comandă…" className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-[12.5px] outline-none focus:border-blue-300 focus:bg-white" />
            </div>
            <div className="flex flex-wrap gap-1">
              {filters
                .filter((f) => f === "toate" || counts.get(f))
                .map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium ${filter === f ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                    {f === "toate" ? "Toate" : STAGE[f].label} <span className="opacity-70">{counts.get(f) ?? 0}</span>
                  </button>
                ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[12.5px]">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2">Nr.</th>
                  <th className="px-3 py-2">Instituția</th>
                  <th className="px-3 py-2">Localitatea</th>
                  <th className="px-3 py-2 text-right">Produse</th>
                  <th className="px-3 py-2 text-right">Kg</th>
                  <th className="px-3 py-2">Mașina</th>
                  <th className="px-3 py-2">Starea</th>
                  <th className="px-3 py-2">Înregistrată</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.slice(0, 400).map(({ o, p, stage, inst, kg }) => (
                  <tr key={o.id} onClick={() => setOpenId(o.id)} className={`cursor-pointer hover:bg-blue-50/50 ${o.status === "anulata" ? "text-slate-400" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums text-slate-600">{o.no}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{inst?.name ?? "Instituție necunoscută"}</div>
                      <div className="text-[10.5px] text-slate-400">{inst ? TYPE_LABEL[inst.type] : ""}{o.note ? ` · ${o.note}` : ""}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{inst?.town ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{o.lines.length}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-800">{Math.round(kg)}</td>
                    <td className="px-3 py-2">
                      {p ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                          <TruckBadge truck={p.truck} size={18} /> <span className="tabular-nums">~{fmtTime(p.stop.arriveAt)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span title={STAGE[stage].hint}>
                        <Chip tone={STAGE[stage].tone}>{STAGE[stage].label}</Chip>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-500">
                      {fmtCreated(o.createdAt)} <span className="text-slate-400">· {o.source === "telefon" ? "telefon" : o.source === "test" ? "test" : o.source === "1c" ? "1C" : "exemplu"}</span>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-[12.5px] text-slate-400">
                      {rows.length ? "Nicio comandă nu corespunde filtrului." : "Nicio comandă pentru această zi."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {shown.length > 400 && <div className="px-3 py-2 text-[11px] text-slate-400">Se arată primele 400 din {shown.length}. Folosiți căutarea.</div>}
          </div>
        </Card>
      </div>
      {open && <OrderDrawer order={open.o} demo={r.demo} onClose={() => setOpenId(null)} />}
      {newOpen && <NewOrderModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}

/* ---------- the cycle of the day ---------- */

function CycleBar({ date }: { date: string }) {
  const r = useDay(date);
  const day = useUi((s) => s.day);
  const t = useMinute();
  const conf = useUi((s) => s.confirmations);
  const setView = useUi((s) => s.setView);
  const live = r.orders.filter((o) => o.status !== "anulata");
  const withTrucks = r.trucks.filter((x) => x.stops.length);
  const loaded = withTrucks.filter((x) => r.saved?.loaded[x.number]).length;
  const place = placements(r);
  const stages = live.map((o) => stageOf(o, place.get(o.id), r, { today: day, t, conf }));
  const delivered = stages.filter((s) => s === "livrata").length;
  const problems = stages.filter((s) => s === "problema").length;
  const invoices = live.filter((o) => o.invoiceNo).length;
  const steps = [
    { icon: Phone, title: "1. Comenzi primite", value: `${live.length}`, sub: `${(live.reduce((a, o) => a + orderKg(o), 0) / 1000).toFixed(1)} t`, done: live.length > 0, go: undefined as undefined | (() => void) },
    { icon: Route, title: "2. Trasee", value: r.unplanned.length ? `${r.unplanned.length} fără mașină` : `${withTrucks.length} mașini`, sub: r.saved?.approved ? "aprobate" : r.saved ? "salvate, neaprobate" : "automat", done: !!r.saved?.approved && !r.unplanned.length, warn: r.unplanned.length > 0, go: () => setView("planning") },
    { icon: PackageCheck, title: "3. Încărcare", value: `${loaded}/${withTrucks.length}`, sub: "beci + rampă", done: withTrucks.length > 0 && loaded === withTrucks.length, go: () => setView("planning") },
    { icon: TruckIcon, title: "4. Livrare", value: `${delivered}/${live.length}`, sub: problems ? `${problems} probleme` : "confirmate de șoferi", done: live.length > 0 && delivered === live.length, warn: problems > 0, go: () => setView("deliveries") },
    { icon: Receipt, title: "5. Facturi", value: `${invoices}/${live.length}`, sub: "cu nr. factură", done: live.length > 0 && invoices === live.length, go: undefined },
  ];
  return (
    <ol className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
      {steps.map((s) => (
        <li key={s.title}>
          <button disabled={!s.go} onClick={s.go} className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${s.warn ? "border-rose-200 bg-rose-50/60" : s.done ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"} ${s.go ? "hover:border-blue-300" : ""}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${s.warn ? "bg-rose-100 text-rose-600" : s.done ? "bg-emerald-100 text-emerald-700" : "bg-blue-50 text-blue-600"}`}>{s.done && !s.warn ? <Check size={15} /> : <s.icon size={15} />}</span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[10.5px] font-semibold text-slate-500">{s.title}</span>
              <span className="block truncate text-[14px] font-semibold tabular-nums text-slate-900">{s.value}</span>
              <span className="block truncate text-[10.5px] text-slate-400">{s.sub}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function DemoBanner({ date, onNew }: { date: string; onNew: () => void }) {
  const createTest = useUi((s) => s.createTestOrders);
  const storage = useUi((s) => s.storage);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900 ring-1 ring-amber-200">
      <FlaskConical size={18} className="shrink-0 text-amber-600" />
      <div className="min-w-[240px] flex-1">
        <b>Nicio comandă reală pentru {dayLabel(date).toLowerCase()}.</b> Mai jos sunt comenzi exemplu, ca să vedeți cum arată ziua. Ele nu se salvează și nu schimbă stocul.
      </div>
      <button onClick={onNew} className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700">
        Înregistrați prima comandă
      </button>
      <button
        disabled={busy || storage !== "server"}
        title={storage !== "server" ? "Este nevoie de server" : "Creează comenzi de test reale (marcate „test”), ca să încercați tot ciclul. Se pot șterge oricând."}
        onClick={async () => {
          setBusy(true);
          await createTest(date);
          setBusy(false);
        }}
        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
      >
        {busy ? "Se creează…" : "Generează comenzi de test"}
      </button>
    </div>
  );
}

/** Weight by storage zone and whether the stock covers the day. */
function DaySummary({ date }: { date: string }) {
  const r = useDay(date);
  const outlook = useOutlook();
  const setView = useUi((s) => s.setView);
  const deleteTest = useUi((s) => s.deleteTestOrders);
  const live = r.orders.filter((o) => o.status !== "anulata");
  const lines = live.flatMap((o) => o.lines);
  const byZone = { cellar: 0, cold: 0, dry: 0 } as Record<Product["zone"], number>;
  lines.forEach((l) => {
    const p = PRODUCT_BY_ID.get(l.productId);
    if (p) byZone[p.zone] += p.unit === "pcs" ? l.qty * 0.5 : l.qty;
  });
  const total = Object.values(byZone).reduce((a, b) => a + b, 0) || 1;
  const short = outlook.shortOn(date);
  const tests = r.orders.filter((o) => o.source === "test").length;
  const institutions = new Set(live.map((o) => o.institutionId)).size;
  return (
    <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="font-semibold text-slate-800">Ce trebuie pregătit</span>
          <span className="text-slate-500">
            {live.length} comenzi · {institutions} instituții · {(total / 1000).toFixed(1)} t
          </span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
          {(["cellar", "cold", "dry"] as const).map((z) => (
            <span key={z} style={{ width: `${(byZone[z] / total) * 100}%`, background: z === "cellar" ? "#8cc56b" : z === "cold" ? "#7fb2f0" : "#e8b45a" }} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px]">
          {(["cellar", "cold", "dry"] as const).map((z) => (
            <div key={z} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: z === "cellar" ? "#8cc56b" : z === "cold" ? "#7fb2f0" : "#e8b45a" }} />
              <span className="text-slate-500">{ZONE_SHORT[z]}</span>
              <span className="ml-auto font-medium tabular-nums text-slate-800">{fmtQty(byZone[z])} kg</span>
            </div>
          ))}
        </div>
        {tests > 0 && (
          <button onClick={() => confirm(`Ștergeți cele ${tests} comenzi de test pentru această zi?`) && void deleteTest(date)} className="mt-3 flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-600">
            <Trash2 size={11} /> Șterge cele {tests} comenzi de test
          </button>
        )}
      </Card>
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="font-semibold text-slate-800">Stocul pentru această zi</span>
          <button onClick={() => setView("stock")} className="flex items-center gap-0.5 text-blue-600 hover:underline">
            Stoc <ChevronRight size={13} />
          </button>
        </div>
        {short.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800 ring-1 ring-emerald-200">
            <Check size={14} /> Stocul acoperă toate comenzile.
          </div>
        ) : (
          <ul className="space-y-1">
            {short.slice(0, 5).map((s) => (
              <li key={s.product.id} className="flex items-center gap-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-800 ring-1 ring-rose-200">
                <span className="flex-1">{s.product.name}</span>
                <span className="tabular-nums">
                  lipsesc {fmtQty(s.missing)} {unitLabel(s.product.unit)}
                </span>
              </li>
            ))}
            {short.length > 5 && <li className="text-[11px] text-rose-700">și încă {short.length - 5} produse</li>}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------- order lines editor (new order and order details) ---------- */

function LinesEditor({ value, onChange, autoFocusSearch = false }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void; autoFocusSearch?: boolean }) {
  const [q, setQ] = useState("");
  const [onlyFilled, setOnlyFilled] = useState(false);
  const n = normalize(q);
  const list = PRODUCTS.filter((p) => (!n || normalize(p.name).includes(n)) && (!onlyFilled || Number(value[p.id]) > 0));
  const kg = Object.entries(value).reduce((a, [id, v]) => a + (Number(v) > 0 ? (PRODUCT_BY_ID.get(id)?.unit === "pcs" ? Number(v) * 0.5 : Number(v)) : 0), 0);
  const filled = Object.values(value).filter((v) => Number(v) > 0).length;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus={autoFocusSearch} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută produs…" className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-2 text-[12px] outline-none focus:border-blue-300 focus:bg-white" />
        </div>
        <label className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
          <input type="checkbox" checked={onlyFilled} onChange={(e) => setOnlyFilled(e.target.checked)} /> doar cele completate
        </label>
        <span className="text-[11.5px] font-medium text-slate-700">
          {filled} produse · {Math.round(kg)} kg
        </span>
      </div>
      <div className="grid max-h-[46vh] gap-x-4 overflow-y-auto pr-1 sm:grid-cols-2">
        {(["cellar", "cold", "dry"] as const).map((zone) => {
          const items = list.filter((p) => p.zone === zone);
          if (!items.length) return null;
          return (
            <div key={zone} className="sm:col-span-2">
              <div className="sticky top-0 z-10 bg-white/95 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{ZONE_SHORT[zone]}</div>
              <div className="grid gap-x-4 sm:grid-cols-2">
                {items.map((p) => (
                  <label key={p.id} className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${Number(value[p.id]) > 0 ? "bg-blue-50/70" : "hover:bg-slate-50"}`}>
                    <span className="h-3 w-3 shrink-0 rounded" style={{ background: p.color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }} />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700">{p.name}</span>
                    <input
                      inputMode="decimal"
                      value={value[p.id] ?? ""}
                      onChange={(e) => onChange({ ...value, [p.id]: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") })}
                      placeholder="0"
                      className="h-7 w-[70px] rounded-md border border-slate-200 px-1.5 text-right text-[12px] tabular-nums outline-none focus:border-blue-400"
                    />
                    <span className="w-6 text-[10.5px] text-slate-400">{unitLabel(p.unit)}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const toInputs = (lines: OrderLine[]) => Object.fromEntries(lines.map((l) => [l.productId, String(l.qty)]));
const toLines = (v: Record<string, string>): OrderLine[] =>
  Object.entries(v)
    .map(([productId, s]) => ({ productId, qty: Math.round(Number(s) * 1000) / 1000 }))
    .filter((l) => l.qty > 0 && PRODUCT_BY_ID.has(l.productId));

/* ---------- institution search ---------- */

function InstitutionPicker({ value, onChange }: { value: Institution | null; onChange: (i: Institution | null) => void }) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const words = normalize(q).split(" ").filter(Boolean);
    if (!words.length) return [];
    return INSTITUTIONS.filter((i) => {
      const hay = normalize(`${i.name} ${i.town} ${i.code ?? ""} ${i.address ?? ""}`);
      return words.every((w) => hay.includes(w));
    }).slice(0, 8);
  }, [q]);
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-blue-600">
          <Building2 size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-slate-900">{value.name}</span>
          <span className="block truncate text-[11px] text-slate-500">
            {TYPE_LABEL[value.type]} · {value.town}
            {value.phone ? ` · ${value.phone}` : ""}
            {value.code ? ` · cod ${value.code}` : ""}
          </span>
        </span>
        <button onClick={() => onChange(null)} className="rounded-lg px-2 py-1 text-[11.5px] text-blue-700 hover:bg-white">
          Schimbă
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input ref={input} autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && results[0] && onChange(results[0])} placeholder="Numele instituției, localitatea sau codul din 1C…" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 text-[13px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.map((i) => (
            <button key={i.id} onClick={() => onChange(i)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-blue-50">
              <span className="truncate font-medium text-slate-800">{i.name}</span>
              <span className="shrink-0 text-[11px] text-slate-400">
                {TYPE_LABEL[i.type]} · {i.town}
              </span>
            </button>
          ))}
        </div>
      )}
      {q && !results.length && <div className="mt-1 text-[11.5px] text-slate-400">Nicio instituție găsită. Instituțiile se importă pe pagina Date.</div>}
    </div>
  );
}

/* ---------- new order ---------- */

function NewOrderModal({ onClose }: { onClose: () => void }) {
  const day = useUi((s) => s.day);
  const orders = useUi((s) => s.orders);
  const createOrder = useUi((s) => s.createOrder);
  const storage = useUi((s) => s.storage);
  const tomorrow = nextWorkday(day);
  const [inst, setInst] = useState<Institution | null>(null);
  const [date, setDate] = useState(tomorrow);
  const [lines, setLines] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const last = inst ? lastOrderOf(orders, inst.id) : null;
  const sameDay = inst ? (orders[date] ?? []).find((o) => o.institutionId === inst.id && o.status !== "anulata") : null;
  const ready = !!inst && toLines(lines).length > 0;

  async function save(again: boolean) {
    if (!inst || !ready || busy) return;
    setBusy(true);
    const o = await createOrder({ institutionId: inst.id, date, lines: toLines(lines), note: note.trim() || undefined });
    setBusy(false);
    if (!o) return;
    if (again) {
      setInst(null);
      setLines({});
      setNote("");
    } else onClose();
  }

  return (
    <Modal title="Comandă nouă" onClose={onClose} onSubmit={() => void save(false)}>
      <div className="space-y-4">
        <Field label="1. Instituția">
          <InstitutionPicker value={inst} onChange={setInst} />
          {sameDay && (
            <div className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-800 ring-1 ring-amber-200">
              Atenție: există deja comanda {sameDay.no} pentru această instituție în aceeași zi.
            </div>
          )}
        </Field>
        <Field label="2. Ziua livrării">
          <div className="flex flex-wrap items-center gap-1.5">
            {[tomorrow, nextWorkday(tomorrow), nextWorkday(nextWorkday(tomorrow))].map((d) => (
              <button key={d} onClick={() => setDate(d)} className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium ${date === d ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {dayLabel(d, day)} {shortDate(d)}
              </button>
            ))}
            <input type="date" value={date} min={day} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-8 rounded-lg border border-slate-200 px-2 text-[12px]" />
            {date === day && <span className="text-[11px] text-amber-700">Livrare azi: traseele zilei sunt deja în lucru.</span>}
          </div>
        </Field>
        <Field
          label="3. Produsele"
          extra={
            last && (
              <button onClick={() => setLines(toInputs(last.lines))} className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11.5px] font-medium text-blue-700 hover:bg-blue-50">
                <Copy size={12} /> Ca ultima comandă ({last.no}, {last.lines.length} produse)
              </button>
            )
          }
        >
          <LinesEditor value={lines} onChange={setLines} />
        </Field>
        <Field label="Notă (opțional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. sunați înainte; intrarea din spate" className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12.5px] outline-none focus:border-blue-400" />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
        {storage !== "server" && <span className="mr-auto text-[11.5px] text-rose-600">Fără server comenzile nu se pot salva.</span>}
        <button onClick={onClose} className="rounded-lg px-3 py-2 text-[12.5px] text-slate-600 hover:bg-slate-100">
          Închide
        </button>
        <button disabled={!ready || busy} onClick={() => void save(true)} className="rounded-lg border border-blue-200 px-3 py-2 text-[12.5px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40">
          Salvează și încă una
        </button>
        <button disabled={!ready || busy} onClick={() => void save(false)} className="rounded-lg bg-blue-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
          {busy ? "Se salvează…" : "Salvează comanda"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- order details ---------- */

function OrderDrawer({ order, demo, onClose }: { order: Order; demo: boolean; onClose: () => void }) {
  const day = useUi((s) => s.day);
  const r = useDay(order.date);
  const t = useMinute();
  const conf = useUi((s) => s.confirmations);
  const updateOrder = useUi((s) => s.updateOrder);
  const moveOrder = useUi((s) => s.moveOrder);
  const inst = INSTITUTION_BY_ID.get(order.institutionId);
  const p = placements(r).get(order.id);
  const stage = stageOf(order, p, r, { today: day, t, conf });
  const [lines, setLines] = useState(() => toInputs(order.lines));
  const [note, setNote] = useState(order.note ?? "");
  const [invoice, setInvoice] = useState(order.invoiceNo ?? "");
  const [busy, setBusy] = useState(false);
  const changed = JSON.stringify(toLines(lines)) !== JSON.stringify(order.lines) || note !== (order.note ?? "") || invoice !== (order.invoiceNo ?? "");
  const readOnly = demo || order.status === "anulata";
  const loaded = p && r.saved?.loaded[p.truck.number];
  const c = order.date === day ? conf[order.no] : undefined;

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    await f();
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel-in flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <ClipboardList size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-blue-600">
              Comanda {order.no} · {dayLabel(order.date, day)} {shortDate(order.date)}
            </div>
            <div className="truncate text-[16px] font-semibold text-slate-900">{inst?.name ?? instName(order.institutionId)}</div>
            <div className="truncate text-[11.5px] text-slate-500">
              {inst ? `${TYPE_LABEL[inst.type]} · ${inst.town}${inst.address ? ` · ${inst.address}` : ""}` : ""}
            </div>
          </div>
          <button aria-label="Închide" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={STAGE[stage].tone}>{STAGE[stage].label}</Chip>
            <span className="text-[11.5px] text-slate-500">{STAGE[stage].hint}</span>
          </div>
          {c?.status === "problem" && <div className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-800 ring-1 ring-rose-200">Șoferul a raportat: {c.reason || "problemă"}.</div>}
          {demo && <div className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 ring-1 ring-amber-200">Comandă exemplu: nu se poate modifica.</div>}

          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <Info k="Înregistrată" v={`${fmtCreated(order.createdAt)} · ${order.source === "telefon" ? "telefon" : order.source}`} />
            <Info k="Greutate" v={`${Math.round(orderKg(order))} kg`} />
            {inst?.phone && (
              <Info
                k="Telefon instituție"
                v={
                  <a href={`tel:${inst.phone.replace(/\s/g, "")}`} className="text-blue-600">
                    {inst.phone}
                  </a>
                }
              />
            )}
            {p && <Info k="Sosire planificată" v={`~${fmtTime(p.stop.arriveAt)} (oprirea ${p.index + 1})`} />}
          </div>

          {!readOnly && (
            <Field label="Mașina">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={p?.truck.number ?? ""}
                  disabled={busy || !!loaded}
                  onChange={(e) => void run(() => moveOrder(order.date, order.id, Number(e.target.value)))}
                  className="h-9 min-w-[220px] rounded-lg border border-slate-200 bg-white px-2 text-[12.5px]"
                >
                  {!p && <option value="">— fără mașină —</option>}
                  {r.trucks.map((tr) => {
                    const kg = tr.stops.reduce((a, s) => a + s.weightKg, 0);
                    return (
                      <option key={tr.number} value={tr.number}>
                        {tr.label}
                        {tr.plate ? ` · ${tr.plate}` : ""} — {tr.region} · {Math.round(kg)}/{tr.capacityKg} kg
                      </option>
                    );
                  })}
                </select>
                {loaded && <span className="text-[11px] text-slate-500">Mașina e deja încărcată.</span>}
              </div>
            </Field>
          )}

          <Field label="Produse">
            {readOnly ? (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {order.lines.map((l) => {
                  const prod = PRODUCT_BY_ID.get(l.productId);
                  return (
                    <li key={l.productId} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
                      <span className="h-3 w-3 rounded" style={{ background: prod?.color ?? "#ccc" }} />
                      <span className="flex-1 text-slate-700">{prod?.name ?? l.productId}</span>
                      <span className="tabular-nums text-slate-600">
                        {fmtQty(l.qty)} {unitLabel(prod?.unit ?? "kg")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <LinesEditor value={lines} onChange={setLines} />
            )}
          </Field>

          {!readOnly && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Notă">
                <input value={note} onChange={(e) => setNote(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12.5px] outline-none focus:border-blue-400" />
              </Field>
              <Field label="Nr. factură (din 1C)">
                <input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="ex. NP-004512" className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12.5px] outline-none focus:border-blue-400" />
              </Field>
              <Field label="Mută pe altă zi">
                <input type="date" min={day} value={order.date} onChange={(e) => e.target.value && e.target.value !== order.date && void run(() => updateOrder(order, { date: e.target.value }).then((o) => o && onClose()))} className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12.5px]" />
              </Field>
            </div>
          )}
        </div>
        {!demo && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
            {order.status === "anulata" ? (
              <button disabled={busy} onClick={() => void run(() => updateOrder(order, { status: "noua" }))} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                <RotateCcw size={13} /> Reactivează
              </button>
            ) : (
              <button disabled={busy || !!loaded} title={loaded ? "Mașina e încărcată: anulați întâi încărcarea" : ""} onClick={() => confirm(`Anulați comanda ${order.no}?`) && void run(() => updateOrder(order, { status: "anulata" }))} className="flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40">
                <Ban size={13} /> Anulează comanda
              </button>
            )}
            <span className="flex-1" />
            {!readOnly && (
              <button
                disabled={!changed || busy || toLines(lines).length === 0}
                onClick={() => void run(() => updateOrder(order, { lines: toLines(lines), note: note.trim(), invoiceNo: invoice.trim() }).then((o) => o && useUi.getState().notify(`Comanda ${o.no} a fost salvată.`)))}
                className="rounded-lg bg-blue-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Salvează modificările
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- small pieces ---------- */

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
      <div className="text-[10.5px] text-slate-400">{k}</div>
      <div className="font-medium text-slate-800">{v}</div>
    </div>
  );
}

