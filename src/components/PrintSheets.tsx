"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { INSTITUTION_BY_ID, PRODUCT_BY_ID, PRODUCTS } from "@/lib/seed";
import { fmtTime } from "@/lib/sim";
import { useTrucks } from "@/lib/store";
import type { StorageZone, Truck } from "@/lib/types";

type Kind = "loading" | "route";
const usePrint = create<{ job: { truckIds: string[]; kind: Kind } | null; set: (job: { truckIds: string[]; kind: Kind } | null) => void }>((set) => ({
  job: null,
  set: (job) => set({ job }),
}));

/** Open the browser's print dialog with one sheet per truck. */
export const printSheets = (truckIds: string[], kind: Kind) => usePrint.getState().set({ truckIds, kind });

const ZONES: [StorageZone, string][] = [
  ["cellar", "Depozit subteran — legume și fructe"],
  ["cold", "Cameră frigorifică"],
  ["dry", "Rafturi — produse uscate"],
];
const unit = (u: string) => (u === "pcs" ? "buc" : u);
const longDate = () => new Date().toLocaleDateString("ro-MD", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function Header({ title, tr }: { title: string; tr: Truck }) {
  const kg = tr.stops.reduce((a, s) => a + s.weightKg, 0);
  return (
    <div className="ps-head">
      <div className="ps-brand">
        <b>NOBIL PREST</b>
        <span>{longDate()}</span>
      </div>
      <h1>{title}</h1>
      <table className="ps-meta">
        <tbody>
          <tr>
            <td>
              Mașina <b>{tr.number}</b> · {tr.plate || "—"}
            </td>
            <td>{tr.model}</td>
            <td>Șofer: {tr.driver || "________________"}</td>
          </tr>
          <tr>
            <td>
              Rampa R{tr.dock} · încărcare {fmtTime(tr.loadStart)}–{fmtTime(tr.departAt)}
            </td>
            <td>
              Plecare {fmtTime(tr.departAt)} · întoarcere ~{fmtTime(tr.returnAt)}
            </td>
            <td>
              {tr.stops.length} opriri · {kg} kg / {tr.capacityKg} kg · ~{tr.totalKm} km
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Foaie de încărcare: what to pick, by storage zone, and the order to load it (last stop first). */
function LoadingSheet({ tr }: { tr: Truck }) {
  const totals = new Map<string, number>();
  tr.stops.forEach((s) => s.lines.forEach((l) => totals.set(l.productId, (totals.get(l.productId) ?? 0) + l.qty)));
  return (
    <section className="ps-page">
      <Header title="Foaie de încărcare" tr={tr} />
      {ZONES.map(([zone, label]) => {
        const items = PRODUCTS.filter((p) => p.zone === zone && totals.has(p.id));
        if (!items.length) return null;
        return (
          <div key={zone}>
            <h2>{label}</h2>
            <table className="ps-table">
              <thead>
                <tr>
                  <th>Produs</th>
                  <th className="r">Cantitate</th>
                  <th>U.M.</th>
                  <th className="c">Pregătit ✓</th>
                  <th className="c">Încărcat ✓</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="r">
                      <b>{totals.get(p.id)}</b>
                    </td>
                    <td>{unit(p.unit)}</td>
                    <td className="c">☐</td>
                    <td className="c">☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <h2>Ordinea de încărcare (ultima livrare se încarcă prima, lângă uși rămâne prima)</h2>
      <table className="ps-table">
        <thead>
          <tr>
            <th>Livrarea</th>
            <th>Instituția</th>
            <th>Comanda</th>
            <th className="r">kg</th>
            <th>Conținut</th>
          </tr>
        </thead>
        <tbody>
          {[...tr.stops].reverse().map((s) => {
            const inst = INSTITUTION_BY_ID.get(s.institutionId)!;
            return (
              <tr key={s.id}>
                <td className="c">{tr.stops.indexOf(s) + 1}</td>
                <td>
                  {inst.name}, {inst.town}
                </td>
                <td>{s.orderNo}</td>
                <td className="r">{s.weightKg}</td>
                <td className="small">{s.lines.map((l) => `${PRODUCT_BY_ID.get(l.productId)!.name} ${l.qty}`).join(" · ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="ps-sign">
        <span>Pregătit de: ____________________</span>
        <span>Verificat de: ____________________</span>
        <span>Șofer: ____________________</span>
      </div>
    </section>
  );
}

/** Foaie de parcurs: the driver's list of stops in order, with room for times and notes. */
function RouteSheet({ tr }: { tr: Truck }) {
  return (
    <section className="ps-page ps-landscape">
      <Header title="Foaie de parcurs" tr={tr} />
      <table className="ps-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Ora plan</th>
            <th>Instituția</th>
            <th>Adresa</th>
            <th>Telefon</th>
            <th>Comanda</th>
            <th>Nr. factură</th>
            <th className="r">kg</th>
            <th>Ora sosirii</th>
            <th>Observații</th>
          </tr>
        </thead>
        <tbody>
          {tr.stops.map((s, i) => {
            const inst = INSTITUTION_BY_ID.get(s.institutionId)!;
            return (
              <tr key={s.id}>
                <td className="c">{i + 1}</td>
                <td>{fmtTime(s.arriveAt)}</td>
                <td>{inst.name}</td>
                <td className="small">{[inst.address, inst.town].filter(Boolean).join(", ")}</td>
                <td className="small">{inst.phone ?? ""}</td>
                <td className="small">{s.orderNo}</td>
                <td />
                <td className="r">{s.weightKg}</td>
                <td />
                <td />
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="ps-sign">
        <span>Km la plecare: __________</span>
        <span>Km la întoarcere: __________</span>
        <span>Combustibil alimentat: ______ l</span>
      </div>
      <div className="ps-sign">
        <span>Ora plecării: ______</span>
        <span>Ora întoarcerii: ______</span>
        <span>Semnătura șoferului: ____________________</span>
      </div>
    </section>
  );
}

/** Hidden until printing; rendered outside the app layout so the sheet prints cleanly on A4. */
export function PrintRoot() {
  const job = usePrint((s) => s.job);
  const trucks = useTrucks();
  useEffect(() => {
    if (!job) return;
    const done = () => usePrint.getState().set(null);
    window.addEventListener("afterprint", done, { once: true });
    const id = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(id);
      window.removeEventListener("afterprint", done);
    };
  }, [job]);
  if (!job) return null;
  const list = trucks.filter((t) => job.truckIds.includes(t.id) && t.stops.length);
  return (
    <div id="print-root">
      {list.map((tr) => (job.kind === "loading" ? <LoadingSheet key={tr.id} tr={tr} /> : <RouteSheet key={tr.id} tr={tr} />))}
    </div>
  );
}
