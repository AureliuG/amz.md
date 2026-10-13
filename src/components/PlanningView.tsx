"use client";

import { CheckCircle2, CircleAlert, Lock, PackageCheck, Printer, RefreshCw, Route, Undo2, Unlock, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { dayLabel, longDate } from "@/lib/dates";
import { lateStops, orderKg, truckLoadKg } from "@/lib/planner";
import { DELIVER_BY, INSTITUTION_BY_ID } from "@/lib/seed";
import { loadingPlace, PLACE_LABEL, STATUS_LABEL, STATUS_TONE, fmtTime, truckState } from "@/lib/sim";
import { DAY_END, DAY_START, instName, useDay, useMinute, useUi } from "@/lib/store";
import type { Truck } from "@/lib/types";
import { DayPicker } from "./hud/DayPicker";
import { TruckBadge } from "./hud/DetailPanel";
import { Card, Chip } from "./hud/ui";
import { printSheets } from "./PrintSheets";

type Kind = "beci" | "load" | "drive" | "unload" | "return";
const KIND: Record<Kind, { label: string; color: string }> = {
  beci: { label: "Beci", color: "#a3763b" },
  load: { label: "Rampă", color: "#f59e0b" },
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
  if (!tr.stops.length) return [];
  const out: Seg[] = [];
  if (tr.beci) out.push({ kind: "beci", from: tr.beci.from, to: tr.beci.to, title: "Încărcare la beci (legume, fructe)", sub: `ordinea ${tr.loadOrder}` });
  out.push({ kind: "load", from: tr.ramp.from, to: tr.ramp.to, title: "Încărcare la rampă", sub: `${truckLoadKg(tr)} kg în total` });
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
const pct = (m: number) => `${((Math.min(DAY_END, Math.max(DAY_START, m)) - DAY_START) / span) * 100}%`;
const HOURS = Array.from({ length: Math.floor(DAY_END / 60) - Math.ceil(DAY_START / 60) + 1 }, (_, i) => Math.ceil(DAY_START / 60) + i);

/** Routes of a day: generate, adjust and approve them, run the loading (beci → ramp), and see the day as a timeline. */
export function PlanningView() {
  const day = useUi((s) => s.day);
  const date = useUi((s) => s.workDate);
  const setDate = useUi((s) => s.setWorkDate);
  const r = useDay(date);
  const now = useMinute();
  const isToday = date === day;
  const t = isToday ? now : DAY_START;
  const select = useUi((s) => s.select);
  const selection = useUi((s) => s.selection);
  const trucks = r.trucks;
  const used = trucks.filter((x) => x.stops.length);
  const segs = useMemo(() => trucks.map(segments), [trucks]);
  const [tip, setTip] = useState<{ x: number; y: number; seg: Seg; truck: Truck } | null>(null);

  useEffect(() => {
    void useUi.getState().fetchDay(date);
  }, [date]);

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#eef2fb]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 p-3 sm:p-4">
        <Card className="panel-in p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[16px] font-semibold text-slate-900">
                <Route size={18} className="text-blue-600" /> Trasee · {dayLabel(date, day)}
              </div>
              <div className="text-[12px] text-slate-500">
                {longDate(date)} · {r.orders.length} comenzi în {used.length} mașini{r.demo ? " · comenzi exemplu" : ""}
              </div>
            </div>
            <DayPicker date={date} today={day} onChange={setDate} />
          </div>
          <PlanActions date={date} />
        </Card>

        {r.unplanned.length > 0 && <Unplanned date={date} />}
        <LoadingQueue date={date} t={t} isToday={isToday} />

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-[14px] font-semibold text-slate-900">Programul zilei</div>
              <div className="text-[11px] text-slate-500">Fiecare rând este o mașină{isToday ? ". Linia albastră arată ora curentă." : "."}</div>
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
                {trucks.map((tr, k) => {
                  const st = truckState(tr, t);
                  const active = selection?.kind === "truck" && selection.id === tr.id;
                  return (
                    <div key={tr.id} className={`grid grid-cols-[220px_1fr] border-b border-slate-100 transition-colors ${active ? "bg-blue-50/70" : "hover:bg-slate-50/70"} ${tr.stops.length ? "" : "opacity-50"}`}>
                      <button onClick={() => isToday && select({ kind: "truck", id: tr.id })} className="flex items-center gap-2 px-4 py-2 text-left">
                        <TruckBadge truck={tr} size={22} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold text-slate-800">{tr.label}</span>
                          <span className="block truncate text-[10.5px] text-slate-400">{tr.region}</span>
                        </span>
                        {isToday && tr.stops.length > 0 && <Chip tone={STATUS_TONE[st.status]}>{STATUS_LABEL[st.status]}</Chip>}
                      </button>
                      <div className="relative mr-6 h-12">
                        {HOURS.map((h) => (
                          <span key={h} className="absolute inset-y-0 w-px bg-slate-100" style={{ left: pct(h * 60) }} />
                        ))}
                        {segs[k].map((s, i) => {
                          const past = !isToday || s.to <= t;
                          const current = isToday && s.from <= t && t < s.to;
                          return (
                            <span
                              key={i}
                              onClick={() => isToday && select({ kind: "truck", id: tr.id })}
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
                <div className="pointer-events-none absolute inset-y-0 left-[220px] right-6">
                  <span className="absolute inset-y-0 border-l-2 border-dashed border-rose-300" style={{ left: pct(DELIVER_BY) }} />
                  {isToday && (
                    <span className="absolute inset-y-0 w-0.5 bg-[#2f6bff]" style={{ left: pct(t) }}>
                      <span className="absolute -top-0 left-1/2 -translate-x-1/2 rounded-b-md bg-[#2f6bff] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">{fmtTime(t)}</span>
                    </span>
                  )}
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

/** Generate / approve / reset, and print. */
function PlanActions({ date }: { date: string }) {
  const r = useDay(date);
  const ui = useUi.getState();
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    await f();
    setBusy(false);
  };
  const ids = r.trucks.filter((x) => x.stops.length).map((x) => x.id);
  const late = r.trucks.reduce((a, tr) => a + lateStops(tr).length, 0);
  const over = r.trucks.filter((tr) => truckLoadKg(tr) > tr.capacityKg);
  const state = r.demo ? "demo" : r.saved?.approved ? "approved" : r.saved ? "saved" : "auto";
  const STATE = {
    demo: { tone: "amber" as const, text: "Comenzi exemplu: traseele se fac automat. Înregistrați comenzile reale pe pagina Comenzi." },
    auto: { tone: "blue" as const, text: "Trasee automate: se refac la fiecare comandă nouă. Când sunteți de acord cu ele, apăsați „Aprobă”." },
    saved: { tone: "blue" as const, text: "Trasee salvate (cu modificări manuale), încă neaprobate. Comenzile noi se adaugă automat unde încap." },
    approved: { tone: "green" as const, text: "Trasee aprobate. Comenzile care vin acum pentru această zi așteaptă la „Fără mașină”." },
  }[state];
  return (
    <div className="mt-3 space-y-2">
      <div className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-[12px] ring-1 ${STATE.tone === "green" ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : STATE.tone === "amber" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-blue-50 text-blue-900 ring-blue-200"}`}>
        {state === "approved" ? <Lock size={14} /> : <Route size={14} />}
        <span className="flex-1">{STATE.text}</span>
      </div>
      {(late > 0 || over.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-800 ring-1 ring-rose-200">
          <CircleAlert size={14} />
          {late > 0 && <span>{late} livrări ar ajunge după 18:00.</span>}
          {over.length > 0 && <span>Supraîncărcate: {over.map((x) => x.label).join(", ")}.</span>}
          <span className="text-rose-600">Mutați comenzi pe altă mașină (din Comenzi → comanda → Mașina) sau pe altă zi.</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {!r.demo && (
          <>
            {state === "approved" ? (
              <Btn icon={Unlock} disabled={busy} onClick={() => run(() => ui.approvePlan(date, false))}>
                Anulează aprobarea
              </Btn>
            ) : (
              <Btn icon={CheckCircle2} primary disabled={busy} onClick={() => run(() => ui.approvePlan(date, true))}>
                Aprobă traseele
              </Btn>
            )}
            <Btn icon={Wand2} disabled={busy || state === "approved"} title="Împarte din nou toate comenzile pe mașini" onClick={() => confirm("Refaceți traseele de la zero? Mutările manuale se pierd.") && run(() => ui.generatePlan(date))}>
              Generează din nou
            </Btn>
            {r.saved && state !== "approved" && (
              <Btn icon={RefreshCw} disabled={busy} title="Traseele se fac din nou automat la fiecare comandă" onClick={() => run(() => ui.resetPlan(date))}>
                Revino la automat
              </Btn>
            )}
          </>
        )}
        <Btn icon={Printer} disabled={!ids.length} onClick={() => printSheets(ids, "loading", date)}>
          Toate foile de încărcare
        </Btn>
        <Btn icon={Printer} disabled={!ids.length} onClick={() => printSheets(ids, "route", date)}>
          Toate foile de parcurs
        </Btn>
      </div>
    </div>
  );
}

function Unplanned({ date }: { date: string }) {
  const r = useDay(date);
  const addUnplanned = useUi((s) => s.addUnplanned);
  const setView = useUi((s) => s.setView);
  const kg = r.unplanned.reduce((a, o) => a + orderKg(o), 0);
  return (
    <Card className="border-rose-200 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-rose-700">
          {r.unplanned.length} {r.unplanned.length === 1 ? "comandă fără mașină" : "comenzi fără mașină"} · {Math.round(kg)} kg
        </div>
        <div className="flex gap-1.5">
          <Btn icon={Wand2} primary onClick={() => void addUnplanned(date)}>
            Adaugă-le unde încap
          </Btn>
          <Btn icon={Route} onClick={() => setView("orders")}>
            Vezi în Comenzi
          </Btn>
        </div>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {r.unplanned.slice(0, 12).map((o) => (
          <li key={o.id} className="truncate rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11.5px] text-rose-900">
            {o.no} · {instName(o.institutionId)} · {Math.round(orderKg(o))} kg
          </li>
        ))}
      </ul>
      {r.unplanned.length > 12 && <div className="mt-1 text-[11px] text-rose-700">și încă {r.unplanned.length - 12}</div>}
    </Card>
  );
}

/** One truck at the beci, one at the ramp: the queue, and the warehouse's "Încărcată" confirmation. */
function LoadingQueue({ date, t, isToday }: { date: string; t: number; isToday: boolean }) {
  const r = useDay(date);
  const markLoaded = useUi((s) => s.markLoaded);
  const undoLoaded = useUi((s) => s.undoLoaded);
  const [busy, setBusy] = useState<number | null>(null);
  const queue = r.trucks.filter((x) => x.stops.length).sort((a, b) => a.loadOrder - b.loadOrder);
  const loaded = r.saved?.loaded ?? {};
  if (!queue.length) return null;
  const run = async (n: number, f: () => Promise<void>) => {
    setBusy(n);
    await f();
    setBusy(null);
  };
  const atBeci = isToday ? queue.find((x) => loadingPlace(x, t) === "beci") : undefined;
  const atRamp = isToday ? queue.find((x) => loadingPlace(x, t) === "rampa") : undefined;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-[14px] font-semibold text-slate-900">Încărcarea: beci → rampă</div>
          <div className="text-[11px] text-slate-500">O mașină la beci (legume, fructe) și una la rampa depozitului. Pleacă primele mașinile cu drumul cel mai lung.</div>
        </div>
        {isToday && (
          <div className="flex gap-2 text-[11.5px]">
            <span className="rounded-lg bg-[#a3763b]/10 px-2.5 py-1 text-[#7a5427]">Beci: {atBeci ? atBeci.label : "liber"}</span>
            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800">Rampă: {atRamp ? atRamp.label : "liberă"}</span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[12px]">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Mașina</th>
              <th className="px-3 py-2">Beci</th>
              <th className="px-3 py-2">Rampă</th>
              <th className="px-3 py-2">Pleacă</th>
              <th className="px-3 py-2 text-right">Încărcătură</th>
              <th className="px-3 py-2">Starea</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {queue.map((tr) => {
              const done = loaded[tr.number];
              const place = isToday ? loadingPlace(tr, t) : null;
              const kg = truckLoadKg(tr);
              return (
                <tr key={tr.id} className={place ? "bg-amber-50/50" : ""}>
                  <td className="px-3 py-2 tabular-nums text-slate-400">{tr.loadOrder}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <TruckBadge truck={tr} size={20} />
                      <span>
                        <span className="block font-medium text-slate-800">
                          {tr.label}
                          {tr.plate ? ` · ${tr.plate}` : ""}
                        </span>
                        <span className="block text-[10.5px] text-slate-400">{tr.region}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">{tr.beci ? `${fmtTime(tr.beci.from)}–${fmtTime(tr.beci.to)}` : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">
                    {fmtTime(tr.ramp.from)}–{fmtTime(tr.ramp.to)}
                  </td>
                  <td className="px-3 py-2 font-medium tabular-nums text-slate-800">{fmtTime(tr.departAt)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${kg > tr.capacityKg ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                    {kg} / {tr.capacityKg} kg
                  </td>
                  <td className="px-3 py-2">
                    {done ? (
                      <Chip tone="violet">Încărcată {new Date(done).toLocaleTimeString("ro-MD", { hour: "2-digit", minute: "2-digit" })}</Chip>
                    ) : place ? (
                      <Chip tone="amber">{PLACE_LABEL[place]}</Chip>
                    ) : isToday && t >= tr.departAt ? (
                      <Chip tone="blue">A plecat (după plan)</Chip>
                    ) : (
                      <Chip tone="gray">În așteptare</Chip>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.demo ? null : done ? (
                      <button disabled={busy === tr.number} onClick={() => confirm(`Anulați încărcarea ${tr.label}? Produsele revin în stoc.`) && run(tr.number, () => undoLoaded(date, tr.number))} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100">
                        <Undo2 size={12} /> Anulează
                      </button>
                    ) : (
                      <button disabled={busy === tr.number} onClick={() => run(tr.number, () => markLoaded(date, tr.number))} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-violet-700 disabled:opacity-50">
                        <PackageCheck size={12} /> Încărcată
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!r.demo && <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">„Încărcată” scade produsele mașinii din stoc. Se poate anula dacă a fost apăsat din greșeală.</div>}
    </Card>
  );
}

function Btn({ icon: Icon, children, onClick, primary, disabled, title }: { icon: typeof Route; children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button title={title} disabled={disabled} onClick={onClick} className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium disabled:opacity-40 ${primary ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
      <Icon size={12} /> {children}
    </button>
  );
}
