"use client";

import { CheckCircle2, Download, FileSpreadsheet, LocateFixed, MapPin, RadioTower, RotateCcw, Upload, Warehouse } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FIELD_LABEL, TEMPLATE_CSV, autoMap, geocode, parseLocation, readTable, toInstitutions, type Field, type ImportRow, type Mapping } from "@/lib/importer";
import { DATA_SOURCE, DEFAULT_WAREHOUSE, INSTITUTIONS, WAREHOUSE } from "@/lib/seed";
import { useTrucks, useUi } from "@/lib/store";
import { Card, Chip } from "./hud/ui";

const FIELDS: Field[] = ["name", "town", "address", "lat", "lng", "coords", "phone", "code", "type"];
const PRECISION: Record<ImportRow["precision"], [string, "green" | "amber" | "red"]> = {
  exact: ["coordonate", "green"],
  town: ["centrul localității", "amber"],
  none: ["fără poziție", "red"],
};

function Section({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <Card className="panel-in p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">{icon}</div>
        <div>
          <div className="text-[14px] font-semibold text-slate-900">{title}</div>
          <div className="text-[11.5px] text-slate-500">{sub}</div>
        </div>
      </div>
      {children}
    </Card>
  );
}

const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-40";
const primary = `${btn} bg-blue-600 text-white hover:bg-blue-700`;
const secondary = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;

/** Settings and data import: warehouse location, institutions from Excel/CSV, live GPS feed. */
export function DataView() {
  useUi((s) => s.dataVersion); // redraw after changes
  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#eef2fb]">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 p-3 sm:p-4">
        <WarehouseSection />
        <InstitutionsSection />
        <GpsSection />
      </div>
    </div>
  );
}

function WarehouseSection() {
  const moveWarehouse = useUi((s) => s.moveWarehouse);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const isDefault = WAREHOUSE[0] === DEFAULT_WAREHOUSE[0] && WAREHOUSE[1] === DEFAULT_WAREHOUSE[1];
  return (
    <Section icon={<Warehouse size={18} />} title="Locația depozitului" sub="De aici pleacă și revin toate mașinile. Traseele se recalculează automat.">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ex. 47.0245, 28.9010 sau un link Google Maps complet"
          className="h-9 min-w-[260px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] outline-none focus:border-blue-300 focus:bg-white"
        />
        <button
          className={primary}
          onClick={() => {
            const p = parseLocation(text);
            if (!p) {
              setMsg(/goo\.gl|maps\.app/.test(text) ? "Link-urile scurte (maps.app.goo.gl) nu pot fi citite. În Google Maps țineți apăsat pe pin și copiați cele două numere." : "Nu am recunoscut coordonatele, sau sunt în afara Moldovei.");
              return;
            }
            moveWarehouse(p);
            setMsg(`Salvat: ${p[1].toFixed(5)}, ${p[0].toFixed(5)}`);
            setText("");
          }}
        >
          <LocateFixed size={14} /> Salvează
        </button>
        {!isDefault && (
          <button className={secondary} onClick={() => (moveWarehouse(null), setMsg("Revenit la locația implicită."))}>
            <RotateCcw size={13} /> Implicit
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
        <MapPin size={12} /> Acum: {WAREHOUSE[1].toFixed(5)}, {WAREHOUSE[0].toFixed(5)}
        {isDefault ? <Chip tone="amber">provizoriu</Chip> : <Chip tone="green">setat</Chip>}
        {msg && <span className="text-slate-700">· {msg}</span>}
      </div>
    </Section>
  );
}

function InstitutionsSection() {
  const applyInstitutions = useUi((s) => s.applyInstitutions);
  const [file, setFile] = useState<string | null>(null);
  const [table, setTable] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [geo, setGeo] = useState<Record<number, [number, number]>>({});
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    if (!table) return [];
    const list = toInstitutions(table.rows, mapping);
    // Apply geocoded positions on top.
    return list.map((r, i) => (geo[i] && r.precision !== "exact" ? { ...r, precision: "exact" as const, inst: r.inst ? { ...r.inst, pos: geo[i], precision: "geocoded" as const } : { id: `X${i + 1}`, name: r.name, type: "social" as const, town: r.town || "—", pos: geo[i], windowEnd: 18 * 60, precision: "geocoded" as const, address: r.address } } : r));
  }, [table, mapping, geo]);
  const counts = useMemo(() => ({ exact: rows.filter((r) => r.precision === "exact").length, town: rows.filter((r) => r.precision === "town").length, none: rows.filter((r) => r.precision === "none").length }), [rows]);

  useEffect(() => () => abort.current?.abort(), []);

  async function open(f: File) {
    setMsg(null);
    setGeo({});
    try {
      const t = await readTable(f);
      if (!t.headers.length) throw new Error("empty");
      setTable(t);
      setMapping(autoMap(t.headers));
      setFile(f.name);
    } catch {
      setMsg("Fișierul nu a putut fi citit. Folosiți .xlsx sau .csv.");
    }
  }

  async function geocodeMissing() {
    const todo = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.precision !== "exact" && (r.address || r.town));
    if (!todo.length) return;
    abort.current = new AbortController();
    setBusy({ done: 0, total: todo.length });
    for (let k = 0; k < todo.length; k++) {
      if (abort.current.signal.aborted) break;
      const { r, i } = todo[k];
      try {
        const p = await geocode([r.address, r.town, "Moldova"].filter(Boolean).join(", "), abort.current.signal);
        if (p) setGeo((g) => ({ ...g, [i]: p }));
      } catch {
        if (abort.current.signal.aborted) break;
      }
      setBusy({ done: k + 1, total: todo.length });
      await new Promise((res) => setTimeout(res, 1100)); // OpenStreetMap allows 1 request per second
    }
    setBusy(null);
  }

  const usable = rows.filter((r) => r.inst).map((r) => r.inst!);

  return (
    <Section icon={<FileSpreadsheet size={18} />} title="Instituții (Excel / CSV din 1C)" sub="Încărcați lista instituțiilor. Cele cu coordonate apar exact; celelalte la centrul localității, până le căutăm adresa.">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
        Acum în aplicație: <b className="text-slate-800">{INSTITUTIONS.length}</b> instituții
        {DATA_SOURCE.institutions === "demo" ? <Chip tone="amber">date demo</Chip> : <Chip tone="green">importate</Chip>}
        {DATA_SOURCE.institutions === "import" && (
          <button className="text-blue-600 hover:underline" onClick={() => (applyInstitutions(null), setMsg("Revenit la datele demo."))}>
            revino la demo
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) void open(f);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${drag ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50/60"}`}
      >
        <Upload size={20} className="text-slate-400" />
        <div className="text-[12.5px] text-slate-600">{file ? <b>{file}</b> : "Trageți fișierul aici sau"}</div>
        <div className="flex flex-wrap justify-center gap-2">
          <button className={secondary} onClick={() => input.current?.click()}>
            Alegeți fișierul (.xlsx, .csv)
          </button>
          <a className={secondary} href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + TEMPLATE_CSV)}`} download="model-institutii.csv">
            <Download size={13} /> Model CSV
          </a>
        </div>
        <input ref={input} type="file" accept=".xlsx,.xlsm,.csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && void open(e.target.files[0])} />
      </div>

      {table && (
        <>
          <div className="mt-4 text-[12px] font-semibold text-slate-700">Coloane recunoscute</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {FIELDS.map((f) => (
              <label key={f} className="text-[11px] text-slate-500">
                {FIELD_LABEL[f]}
                <select
                  value={mapping[f] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  className={`mt-0.5 h-8 w-full rounded-lg border bg-white px-1.5 text-[12px] text-slate-700 outline-none ${f === "name" && mapping.name === undefined ? "border-rose-300" : "border-slate-200"}`}
                >
                  <option value="">—</option>
                  {table.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Coloana ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
            <Chip tone="green">{counts.exact} cu coordonate</Chip>
            <Chip tone="amber">{counts.town} la centrul localității</Chip>
            <Chip tone="red">{counts.none} fără poziție</Chip>
            <span className="ml-auto flex flex-wrap gap-2">
              {busy ? (
                <button className={secondary} onClick={() => abort.current?.abort()}>
                  Oprește căutarea ({busy.done}/{busy.total})
                </button>
              ) : (
                <button className={secondary} disabled={counts.town + counts.none === 0} onClick={() => void geocodeMissing()} title="Caută adresele în OpenStreetMap (1 pe secundă)">
                  <MapPin size={13} /> Caută adresele ({counts.town + counts.none})
                </button>
              )}
              <button
                className={primary}
                disabled={!usable.length || !!busy}
                onClick={() => {
                  const ok = applyInstitutions(usable);
                  setMsg(`${usable.length} instituții aplicate${ok ? " și salvate în acest browser" : " (nu s-au putut salva în browser)"}. Traseele demo s-au refăcut pe ele.`);
                }}
              >
                <CheckCircle2 size={14} /> Aplică {usable.length} instituții
              </button>
            </span>
          </div>
          {busy && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-500 transition-[width]" style={{ width: `${(busy.done / busy.total) * 100}%` }} />
            </div>
          )}

          <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2">Denumire</th>
                  <th className="px-3 py-2">Localitate</th>
                  <th className="px-3 py-2">Adresă</th>
                  <th className="px-3 py-2">Poziție</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 300).map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-slate-800">{r.name}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.town || "—"}</td>
                    <td className="max-w-[260px] truncate px-3 py-1.5 text-slate-500">{r.address || "—"}</td>
                    <td className="px-3 py-1.5">
                      <Chip tone={PRECISION[r.precision][1]}>{r.inst?.precision === "geocoded" ? "adresă găsită" : PRECISION[r.precision][0]}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 300 && <div className="px-3 py-2 text-[11px] text-slate-400">… și încă {rows.length - 300} rânduri</div>}
          </div>
        </>
      )}
      {msg && <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700">{msg}</div>}
    </Section>
  );
}

function GpsSection() {
  const trucks = useTrucks();
  const gpsMode = useUi((s) => s.gpsMode);
  const setGpsMode = useUi((s) => s.setGpsMode);
  const live = useUi((s) => s.live);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const now = Date.now();
  const ago = (ts: number) => {
    const m = Math.round((now - ts) / 60000);
    return m < 1 ? "acum" : m < 60 ? `acum ${m} min` : new Date(ts).toLocaleString("ro-MD", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  return (
    <Section icon={<RadioTower size={18} />} title="GPS în timp real" sub="Furnizorul GPS (sau un conector) trimite pozițiile la adresa de mai jos. În modul „Live” mașinile apar unde sunt cu adevărat.">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              ["sim", "Simulare"],
              ["live", "Live GPS"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => setGpsMode(k)} className={`rounded-lg px-3 py-1 text-[12px] font-medium ${gpsMode === k ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
              {label}
            </button>
          ))}
        </div>
        <code className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">POST {origin}/api/gps</code>
      </div>
      <div className="mt-3 overflow-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[560px] text-left text-[12px]">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500">
            <tr>
              <th className="px-3 py-2">Mașina</th>
              <th className="px-3 py-2">Tracker</th>
              <th className="px-3 py-2">Ultima poziție</th>
              <th className="px-3 py-2">Viteză</th>
              <th className="px-3 py-2">Stare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trucks.map((t) => {
              const p = t.trackerId ? live[t.trackerId] : undefined;
              const fresh = p && now - p.ts < 15 * 60_000;
              return (
                <tr key={t.id}>
                  <td className="px-3 py-1.5 font-medium text-slate-800">
                    {t.label} <span className="text-[11px] font-normal text-slate-400">{t.plate}</span>
                  </td>
                  <td className="px-3 py-1.5 tabular-nums text-slate-500">{t.trackerId || "—"}</td>
                  <td className="px-3 py-1.5 text-slate-600">{p ? `${ago(p.ts)} · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` : "—"}</td>
                  <td className="px-3 py-1.5 tabular-nums text-slate-600">{p?.speed !== undefined ? `${Math.round(p.speed)} km/h` : "—"}</td>
                  <td className="px-3 py-1.5">{fresh ? <Chip tone="green">live</Chip> : p ? <Chip tone="amber">vechi</Chip> : t.gpsOk ? <Chip tone="gray">așteaptă date</Chip> : <Chip tone="red">tracker fără semnal</Chip>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Format: {`{"tracker":"059166","lat":47.02,"lng":28.83,"ts":"2026-10-12T08:15:00Z","speed":42,"heading":180}`} (unul sau o listă). Detalii în docs/INTEGRATIONS.md.</p>
    </Section>
  );
}
