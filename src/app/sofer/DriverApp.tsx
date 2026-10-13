"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, MessageSquarePlus, Navigation, Phone, RadioTower, RefreshCw, Truck as TruckIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INSTITUTION_BY_ID, PRODUCT_BY_ID } from "@/lib/seed";
import { fmtTime } from "@/lib/sim";
import { api } from "@/lib/base";
import { useUi } from "@/lib/store";
import type { Confirmation } from "@/lib/types";
import { APP_VERSION_SHORT } from "@/lib/version";

const TRUCK_KEY = "nobilprest.driverTruck";
const QUEUE_KEY = "nobilprest.driverQueue";
const REASONS = ["Închis", "Nu este cine să primească", "Refuzat", "Adresă greșită", "Marfă lipsă / deteriorată", "Altele"];

type Pending = Omit<Confirmation, "ts">;
const loadQueue = (): Pending[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as Pending[];
  } catch {
    return [];
  }
};
const saveQueue = (q: Pending[]) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    // ignore
  }
};

/**
 * Send queued confirmations in order. Taps made without signal wait here and go out when the
 * phone is back online, so nothing is lost on rural roads.
 */
async function flushQueue(): Promise<number> {
  const q = loadQueue();
  let sent = 0;
  for (const item of q) {
    try {
      const res = await fetch(api("/api/events"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
      if (!res.ok) break;
      sent++;
    } catch {
      break;
    }
  }
  saveQueue(q.slice(sent));
  return q.length - sent;
}

export function DriverApp() {
  const trucks = useUi((s) => s.trucks);
  const storage = useUi((s) => s.storage);
  const [truckNo, setTruckNo] = useState<number | null>(null);
  const [server, setServer] = useState<Record<string, Confirmation>>({});
  const [local, setLocal] = useState<Record<string, Pending & { ts: number }>>({});
  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [problemFor, setProblemFor] = useState<string | null>(null);

  useEffect(() => {
    void useUi.getState().loadSaved();
    const saved = Number(localStorage.getItem(TRUCK_KEY));
    if (saved > 0) setTruckNo(saved);
    setPending(loadQueue().length);
  }, []);

  const refresh = useCallback(async () => {
    setPending(await flushQueue());
    // The office may have moved orders between trucks: reload today's routes too.
    const ui = useUi.getState();
    if (ui.storage === "server") void ui.fetchDay(ui.day);
    try {
      const res = await fetch(api("/api/events"), { cache: "no-store" });
      if (res.ok) setServer((await res.json()).confirmations ?? {});
    } catch {
      // offline
    }
  }, []);
  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 20_000);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  const truck = trucks.find((t) => t.number === truckNo);
  const status = (orderNo: string) => {
    const a = server[orderNo];
    const b = local[orderNo];
    return !a ? b : !b ? a : a.ts >= b.ts ? a : b;
  };

  function report(orderNo: string, s: Confirmation["status"], reason?: string) {
    if (!truck) return;
    const item: Pending = { orderNo, truck: truck.number, status: s, reason };
    setLocal((l) => ({ ...l, [orderNo]: { ...item, ts: Date.now() } }));
    saveQueue([...loadQueue(), item]);
    setPending(loadQueue().length);
    setProblemFor(null);
    void refresh();
  }

  if (!truck) {
    return (
      <Shell>
        <h1 className="text-[18px] font-semibold text-slate-900">Alegeți mașina</h1>
        <p className="mb-3 text-[13px] text-slate-500">Numărul este același ca pe foaia de parcurs.</p>
        {storage === "loading" ? (
          <p className="text-[13px] text-slate-400">Se încarcă…</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {trucks.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTruckNo(t.number);
                  localStorage.setItem(TRUCK_KEY, String(t.number));
                }}
                className="flex flex-col items-center rounded-2xl bg-white py-3 shadow-sm ring-1 ring-slate-200 active:bg-blue-50"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl text-[17px] font-bold text-white" style={{ background: t.color }}>
                  {t.number}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">{t.plate || "—"}</span>
              </button>
            ))}
          </div>
        )}
      </Shell>
    );
  }

  const done = truck.stops.filter((s) => status(s.orderNo)?.status === "delivered").length;
  const nextIdx = truck.stops.findIndex((s) => !["delivered", "problem"].includes(status(s.orderNo)?.status ?? ""));
  const kg = truck.stops.reduce((a, s) => a + s.weightKg, 0);

  return (
    <Shell>
      <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <span className="grid h-12 w-12 place-items-center rounded-xl text-[20px] font-bold text-white" style={{ background: truck.color }}>
          {truck.number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold text-slate-900">
            {truck.label} · {truck.plate}
          </div>
          <div className="text-[12px] text-slate-500">
            Plecare {fmtTime(truck.departAt)} · {truck.stops.length} opriri · {kg} kg
          </div>
        </div>
        <button
          className="text-[12px] text-blue-600"
          onClick={() => {
            localStorage.removeItem(TRUCK_KEY);
            setTruckNo(null);
          }}
        >
          Schimbă
        </button>
      </div>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${(done / Math.max(1, truck.stops.length)) * 100}%` }} />
      </div>
      <div className="mb-3 flex items-center justify-between text-[12.5px] text-slate-600">
        <span>
          Livrate: <b>{done}</b> din {truck.stops.length}
        </span>
        <button onClick={() => void refresh()} className="flex items-center gap-1 text-blue-600">
          <RefreshCw size={13} /> {pending > 0 ? `${pending} netrimise` : "Actualizează"}
        </button>
      </div>

      <PhoneGps truckNo={truck.number} />

      <ol className="mt-3 space-y-2.5">
        {truck.stops.map((s, i) => {
          const inst = INSTITUTION_BY_ID.get(s.institutionId)!;
          const st = status(s.orderNo);
          const isNext = i === nextIdx;
          const dest = `${inst.pos[1]},${inst.pos[0]}`;
          return (
            <li key={s.id} className={`rounded-2xl bg-white p-3 shadow-sm ring-1 ${isNext ? "ring-2 ring-blue-500" : st?.status === "delivered" ? "opacity-70 ring-slate-200" : "ring-slate-200"}`}>
              <div className="flex items-start gap-2.5">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold ${st?.status === "delivered" ? "bg-emerald-500 text-white" : st?.status === "problem" ? "bg-rose-500 text-white" : isNext ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold leading-snug text-slate-900">{inst.name}</div>
                  <div className="text-[12.5px] text-slate-500">{[inst.address, inst.town].filter(Boolean).join(", ")}</div>
                  <div className="mt-0.5 text-[12px] text-slate-500">
                    ~{fmtTime(s.arriveAt)} · {s.weightKg} kg · {s.orderNo}
                  </div>
                  {st && (
                    <div className={`mt-1 text-[12px] font-medium ${st.status === "delivered" ? "text-emerald-700" : st.status === "problem" ? "text-rose-700" : "text-sky-700"}`}>
                      {st.status === "delivered" ? "✔ Livrat" : st.status === "arrived" ? "A ajuns" : `⚠ ${st.reason ?? "Problemă"}`} · {new Date(st.ts).toLocaleTimeString("ro-MD", { hour: "2-digit", minute: "2-digit" })}
                      {local[s.orderNo] && !server[s.orderNo] ? " · se trimite…" : ""}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${dest}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 py-2.5 text-[13px] font-medium text-slate-700 active:bg-slate-200">
                  <Navigation size={15} /> Maps
                </a>
                <a href={`https://waze.com/ul?ll=${dest}&navigate=yes`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 py-2.5 text-[13px] font-medium text-slate-700 active:bg-slate-200">
                  <Navigation size={15} /> Waze
                </a>
                {inst.phone ? (
                  <a href={`tel:${inst.phone.replace(/\s/g, "")}`} className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 py-2.5 text-[13px] font-medium text-slate-700 active:bg-slate-200">
                    <Phone size={15} /> Sună
                  </a>
                ) : (
                  <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 py-2.5 text-[13px] font-medium text-slate-700">
                    Produse <ChevronDown size={14} />
                  </button>
                )}
              </div>

              {(open === s.id || inst.phone) && (
                <details open={open === s.id} className="mt-2 text-[12.5px] text-slate-600">
                  <summary className="cursor-pointer text-slate-500">Produse ({s.lines.length})</summary>
                  <ul className="mt-1 space-y-0.5">
                    {s.lines.map((l) => {
                      const p = PRODUCT_BY_ID.get(l.productId) ?? { name: l.productId, unit: "kg", color: "#cbd5e1" };
                      return (
                        <li key={l.productId} className="flex justify-between">
                          <span>{p.name}</span>
                          <span className="tabular-nums">
                            {l.qty} {p.unit === "pcs" ? "buc" : p.unit}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}

              {problemFor === s.orderNo ? (
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {REASONS.map((r) => (
                    <button key={r} onClick={() => report(s.orderNo, "problem", r)} className="rounded-xl bg-rose-50 px-2 py-2.5 text-[12.5px] font-medium text-rose-700 ring-1 ring-rose-200 active:bg-rose-100">
                      {r}
                    </button>
                  ))}
                  <button onClick={() => setProblemFor(null)} className="col-span-2 py-1 text-[12px] text-slate-500">
                    Anulează
                  </button>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-[1fr_1.4fr_1fr] gap-2">
                  <button onClick={() => report(s.orderNo, "arrived")} className="rounded-xl bg-sky-50 py-3 text-[13px] font-semibold text-sky-700 ring-1 ring-sky-200 active:bg-sky-100">
                    Am ajuns
                  </button>
                  <button onClick={() => report(s.orderNo, "delivered")} className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-3 text-[14px] font-semibold text-white active:bg-emerald-700">
                    <CheckCircle2 size={16} /> Livrat
                  </button>
                  <button onClick={() => setProblemFor(s.orderNo)} className="flex items-center justify-center gap-1 rounded-xl bg-rose-50 py-3 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-200 active:bg-rose-100">
                    <AlertTriangle size={14} /> Problemă
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {truck.stops.length === 0 && <p className="mt-6 text-center text-[13px] text-slate-500">Nicio livrare pentru această mașină azi.</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const date = useMemo(() => new Date().toLocaleDateString("ro-MD", { weekday: "long", day: "numeric", month: "long" }), []);
  return (
    <div className="h-dvh overflow-y-auto bg-[#eef2fb]">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#4d82ff] to-[#1f3fb3] text-[12px] font-bold text-white">NP</div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold text-slate-900">Nobil Prest · Șofer</div>
          <div className="text-[11px] text-slate-500 first-letter:uppercase">{date}</div>
        </div>
        <TruckIcon size={18} className="ml-auto text-slate-400" />
      </header>
      <main className="mx-auto max-w-[560px] p-3 pb-10">
        {children}
        <DriverFeedback />
        <p className="mt-4 text-center text-[11px] text-slate-400">Nobil Prest · versiunea {APP_VERSION_SHORT}</p>
      </main>
    </div>
  );
}

/**
 * Share the phone's position while this page is open (for trucks whose tracker doesn't report).
 * Keeps the screen awake so the browser doesn't stop sending.
 */
function PhoneGps({ truckNo }: { truckNo: number }) {
  const [on, setOn] = useState(false);
  const [state, setState] = useState<string>("");
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!on) return;
    if (!("geolocation" in navigator)) {
      setState("Telefonul nu oferă localizare.");
      setOn(false);
      return;
    }
    if (!window.isSecureContext) {
      setState("Localizarea cere o adresă https://.");
      setOn(false);
      return;
    }
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((w) => (wake.current = w)).catch(() => undefined);
    setState("Se caută semnalul GPS…");
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent.current < 25_000) return;
        lastSent.current = now;
        const { latitude, longitude, speed, heading } = pos.coords;
        fetch(api("/api/driver/position"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ truck: truckNo, lat: latitude, lng: longitude, speed: speed !== null ? speed * 3.6 : undefined, heading: heading ?? undefined }),
        })
          .then((r) => setState(r.ok ? `Poziție trimisă la ${new Date().toLocaleTimeString("ro-MD", { hour: "2-digit", minute: "2-digit" })}` : "Serverul nu a primit poziția."))
          .catch(() => setState("Fără internet — se reîncearcă."));
      },
      (err) => setState(err.code === 1 ? "Permiteți accesul la localizare în browser." : "Semnal GPS slab."),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );
    return () => {
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
      void wake.current?.release().catch(() => undefined);
      wake.current = null;
    };
  }, [on, truckNo]);

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <label className="flex items-center gap-2 text-[13.5px] font-medium text-slate-800">
        <RadioTower size={16} className={on ? "text-emerald-600" : "text-slate-400"} />
        <span className="flex-1">Trimite poziția din telefon</span>
        <input type="checkbox" className="h-5 w-5" checked={on} onChange={(e) => setOn(e.target.checked)} />
      </label>
      <p className="mt-1 text-[11.5px] text-slate-500">{state || "Pentru mașinile fără tracker GPS. Lăsați pagina deschisă în timpul cursei."}</p>
    </div>
  );
}

/** Drivers can report a problem with the app or suggest something; it lands in the office's Ghid → Propuneri list. */
function DriverFeedback() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"problema" | "propunere">("problema");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  async function send() {
    const truck = Number(localStorage.getItem(TRUCK_KEY)) || 0;
    const res = await fetch(api("/api/feedback"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: truck ? `Șofer · Mașina ${truck}` : "Șofer", kind, page: "Șofer", priority: kind === "problema" ? "mare" : "medie", text }),
    }).catch(() => null);
    if (res?.ok) {
      setText("");
      setMsg("Trimis. Mulțumim!");
    } else setMsg("Nu s-a trimis. Verificați internetul și încercați din nou.");
  }
  return (
    <div className="mt-5 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left text-[13.5px] font-medium text-slate-700">
        <MessageSquarePlus size={16} className="text-blue-600" /> Ceva nu merge sau aveți o idee?
        <ChevronDown size={15} className={`ml-auto transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["problema", "Problemă"],
                ["propunere", "Propunere"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setKind(k)} className={`rounded-xl py-2 text-[13px] font-medium ${kind === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                {l}
              </button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrieți pe scurt ce s-a întâmplat sau ce ar ajuta…" className="min-h-[80px] w-full rounded-xl border border-slate-200 p-2.5 text-[13.5px] outline-none focus:border-blue-300" />
          <button disabled={text.trim().length < 3} onClick={() => void send()} className="w-full rounded-xl bg-blue-600 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40">
            Trimite la oficiu
          </button>
          {msg && <p className="text-center text-[12.5px] text-slate-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}
