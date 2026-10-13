"use client";

import { ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardCheck, PackagePlus, Pencil, Plus, Scale, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { addDays, dayLabel, nextWorkday } from "@/lib/dates";
import { normalize, PRODUCT_BY_ID, PRODUCTS } from "@/lib/seed";
import { BUILTIN_PRODUCTS, fmtQty, levelOf, sumLines, unitLabel, ZONE_LABEL, ZONE_SHORT } from "@/lib/stock";
import { useUi } from "@/lib/store";
import type { Product, StockMove } from "@/lib/types";
import { Card, Chip } from "./hud/ui";
import { Field, Modal } from "./hud/Modal";

/**
 * What the stock looks like against the orders: needed per day (goods not yet loaded), what is left,
 * what is missing. Only days with real orders count against later days.
 */
export function useOutlook() {
  const levels = useUi((s) => s.levels);
  const day = useUi((s) => s.day);
  const orders = useUi((s) => s.orders);
  useUi((s) => s.dataVersion);
  return useMemo(() => {
    const { dayFor } = useUi.getState();
    const real = (d: string) => (orders[d]?.length ?? 0) > 0;
    /** Goods still to load for a day (orders not cancelled, minus vehicles already loaded). */
    const needOn = (d: string) => {
      const r = dayFor(d);
      const loadedOrders = new Set(r.trucks.filter((tr) => r.saved?.loaded[tr.number]).flatMap((tr) => tr.stops.map((s) => s.orderId)));
      return sumLines(r.orders.filter((o) => !loadedOrders.has(o.id)).flatMap((o) => o.lines));
    };
    const before = (d: string) => {
      const m = new Map<string, number>();
      for (let x = day; x < d; x = addDays(x, 1)) if (real(x)) needOn(x).forEach((q, id) => m.set(id, (m.get(id) ?? 0) + q));
      return m;
    };
    const shortOn = (d: string) => {
      const need = needOn(d);
      const used = before(d);
      return PRODUCTS.flatMap((product) => {
        const missing = (need.get(product.id) ?? 0) - (levelOf(levels, product.id) - (used.get(product.id) ?? 0));
        return missing > 0.001 ? [{ product, missing }] : [];
      });
    };
    return { needOn, shortOn, level: (id: string) => levelOf(levels, id), todayDemo: !real(day) };
  }, [levels, day, orders]);
}

type Status = "lipsa" | "sub-minim" | "ok";

export function StockView() {
  const day = useUi((s) => s.day);
  const levels = useUi((s) => s.levels);
  const moves = useUi((s) => s.moves);
  const storage = useUi((s) => s.storage);
  const outlook = useOutlook();
  const tomorrow = nextWorkday(day);
  const [q, setQ] = useState("");
  const [zone, setZone] = useState<"toate" | Product["zone"]>("toate");
  const [modal, setModal] = useState<null | "intrare" | "inventar" | "produse">(null);
  const [onlyProblems, setOnlyProblems] = useState(false);

  useEffect(() => {
    void useUi.getState().fetchStock();
    void useUi.getState().fetchDay(tomorrow);
  }, [tomorrow]);

  const rows = useMemo(() => {
    const today = outlook.needOn(day);
    const next = outlook.needOn(tomorrow);
    return PRODUCTS.map((p) => {
      const level = outlook.level(p.id);
      const needToday = today.get(p.id) ?? 0;
      const needNext = next.get(p.id) ?? 0;
      const after = level - needToday - needNext;
      const status: Status = after < 0 || level < needToday ? "lipsa" : after < p.min ? "sub-minim" : "ok";
      // Suggest enough to cover the next two days and get back to twice the minimum.
      const toOrder = status === "ok" ? 0 : Math.ceil((p.min * 2 - after) / 10) * 10;
      return { p, level, needToday, needNext, after, status, toOrder };
    });
  }, [outlook, day, tomorrow]);
  const n = normalize(q);
  const shown = rows.filter((r) => (zone === "toate" || r.p.zone === zone) && (!n || normalize(r.p.name).includes(n)) && (!onlyProblems || r.status !== "ok"));
  const problems = rows.filter((r) => r.status !== "ok");

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#eef2fb]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 p-3 sm:p-4">
        <Card className="panel-in p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[16px] font-semibold text-slate-900">
                <Boxes size={18} className="text-blue-600" /> Stoc
              </div>
              <div className="max-w-[720px] text-[12px] text-slate-500">
                Stocul scade când depozitul confirmă că o mașină e încărcată și crește la fiecare intrare de marfă. Inventarierea pune cantitatea numărată.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton icon={ArrowDownToLine} label="Intrare marfă" primary onClick={() => setModal("intrare")} disabled={storage !== "server"} />
              <ActionButton icon={ClipboardCheck} label="Inventariere" onClick={() => setModal("inventar")} disabled={storage !== "server"} />
              <ActionButton icon={PackagePlus} label="Produse" onClick={() => setModal("produse")} disabled={storage !== "server"} />
            </div>
          </div>
          {!levels && (
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ring-1 ring-amber-200">
              Cantitățile de mai jos sunt <b>de pornire (exemplu)</b>. Faceți o <b>Inventariere</b> cu stocul real, sau înregistrați intrările de marfă. Mai târziu stocul va veni automat din 1C.
            </div>
          )}
          {outlook.todayDemo && <div className="mt-2 text-[11.5px] text-slate-400">Necesarul de azi vine din comenzi exemplu (nu există comenzi reale pentru azi).</div>}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Produse" value={PRODUCTS.length} />
            <Stat label="Lipsesc pentru azi/mâine" value={rows.filter((r) => r.status === "lipsa").length} tone={rows.some((r) => r.status === "lipsa") ? "red" : undefined} />
            <Stat label="Sub minim după livrări" value={rows.filter((r) => r.status === "sub-minim").length} tone={rows.some((r) => r.status === "sub-minim") ? "amber" : undefined} />
            <Stat label="Mișcări înregistrate" value={moves.length} />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută produs…" className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-[12.5px] outline-none focus:border-blue-300 focus:bg-white" />
            </div>
            <div className="flex gap-1">
              {(["toate", "cellar", "cold", "dry"] as const).map((z) => (
                <button key={z} onClick={() => setZone(z)} className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium ${zone === z ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                  {z === "toate" ? "Toate" : ZONE_SHORT[z]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
              <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> doar de comandat ({problems.length})
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[12.5px]">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2">Produs</th>
                  <th className="px-3 py-2">Zona</th>
                  <th className="px-3 py-2 text-right">În stoc</th>
                  <th className="px-3 py-2 text-right">De încărcat azi</th>
                  <th className="px-3 py-2 text-right">{dayLabel(tomorrow, day)}</th>
                  <th className="px-3 py-2 text-right">Rămâne</th>
                  <th className="px-3 py-2 text-right">Minim</th>
                  <th className="px-3 py-2">Starea</th>
                  <th className="px-3 py-2 text-right">De comandat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map(({ p, level, needToday, needNext, after, status, toOrder }) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded" style={{ background: p.color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }} />
                        <span className="font-medium text-slate-800">{p.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{ZONE_SHORT[p.zone]}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {fmtQty(level)} <span className="font-normal text-slate-400">{unitLabel(p.unit)}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{needToday ? fmtQty(needToday) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{needNext ? fmtQty(needNext) : "—"}</td>
                    <td className={`px-3 py-2 text-right font-medium tabular-nums ${after < 0 ? "text-rose-600" : after < p.min ? "text-amber-700" : "text-slate-800"}`}>{fmtQty(after)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400">{fmtQty(p.min)}</td>
                    <td className="px-3 py-2">
                      <Chip tone={status === "lipsa" ? "red" : status === "sub-minim" ? "amber" : "green"}>{status === "lipsa" ? "Lipsă" : status === "sub-minim" ? "Sub minim" : "OK"}</Chip>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-800">{toOrder ? `${fmtQty(toOrder)} ${unitLabel(p.unit)}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-2 text-[13px] font-semibold text-slate-800">Ultimele mișcări de stoc</div>
          {moves.length === 0 ? (
            <p className="text-[12px] text-slate-400">Încă nicio mișcare. Apar aici intrările de marfă, încărcările mașinilor și inventarierile.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {moves.slice(0, 60).map((m) => (
                <MoveRow key={m.id} m={m} />
              ))}
            </ul>
          )}
        </Card>
      </div>
      {modal === "intrare" && <ReceiptModal onClose={() => setModal(null)} />}
      {modal === "inventar" && <CountModal onClose={() => setModal(null)} />}
      {modal === "produse" && <ProductsModal onClose={() => setModal(null)} />}
    </div>
  );
}

const MOVE_LABEL: Record<StockMove["type"], { label: string; tone: "green" | "violet" | "blue" }> = { intrare: { label: "Intrare", tone: "green" }, iesire: { label: "Ieșire", tone: "violet" }, corectie: { label: "Inventar", tone: "blue" } };

function MoveRow({ m }: { m: StockMove }) {
  const Icon = m.type === "intrare" ? ArrowDownToLine : m.type === "iesire" ? ArrowUpFromLine : Scale;
  const total = m.lines.reduce((a, l) => a + l.qty, 0);
  return (
    <li className="flex items-start gap-3 py-2 text-[12px]">
      <span className="mt-0.5 text-slate-400">
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <Chip tone={MOVE_LABEL[m.type].tone}>{MOVE_LABEL[m.type].label}</Chip>
          <span className="font-medium text-slate-800">{m.note || `${m.lines.length} produse`}</span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-500">
          {m.lines
            .slice(0, 6)
            .map((l) => `${PRODUCT_BY_ID.get(l.productId)?.name ?? l.productId} ${fmtQty(l.qty)}`)
            .join(" · ")}
          {m.lines.length > 6 ? ` · +${m.lines.length - 6}` : ""}
        </span>
      </span>
      <span className="whitespace-nowrap text-[11px] text-slate-400">
        {m.type !== "corectie" && `${fmtQty(total)} · `}
        {new Date(m.ts).toLocaleString("ro-MD", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
      </span>
    </li>
  );
}

function ActionButton({ icon: Icon, label, onClick, primary, disabled }: { icon: typeof Plus; label: string; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button disabled={disabled} title={disabled ? "Este nevoie de server" : undefined} onClick={onClick} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold disabled:opacity-40 ${primary ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
      <Icon size={14} /> {label}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "red" | "amber" }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${tone === "red" ? "bg-rose-50 ring-1 ring-rose-200" : tone === "amber" ? "bg-amber-50 ring-1 ring-amber-200" : "bg-slate-50"}`}>
      <div className="text-[10.5px] text-slate-500">{label}</div>
      <div className={`text-[18px] font-semibold tabular-nums ${tone === "red" ? "text-rose-700" : tone === "amber" ? "text-amber-800" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

/** Quantities per product, typed in a compact list (receipt and inventory). */
function QtyList({ value, onChange, placeholder, current }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void; placeholder?: (p: Product) => string; current?: boolean }) {
  const [q, setQ] = useState("");
  const n = normalize(q);
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută produs…" className="mb-2 h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[12px] outline-none focus:border-blue-300 focus:bg-white" />
      <div className="max-h-[46vh] space-y-0.5 overflow-y-auto pr-1">
        {PRODUCTS.filter((p) => !n || normalize(p.name).includes(n)).map((p) => (
          <label key={p.id} className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${value[p.id] ? "bg-blue-50/70" : "hover:bg-slate-50"}`}>
            <span className="h-3 w-3 shrink-0 rounded" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-700">{p.name}</span>
            <span className="text-[10.5px] text-slate-400">{ZONE_SHORT[p.zone]}</span>
            {current && <CurrentLevel id={p.id} unit={p.unit} />}
            <input inputMode="decimal" value={value[p.id] ?? ""} placeholder={placeholder?.(p) ?? "0"} onChange={(e) => onChange({ ...value, [p.id]: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") })} className="h-7 w-[84px] rounded-md border border-slate-200 px-1.5 text-right text-[12px] tabular-nums outline-none focus:border-blue-400" />
            <span className="w-6 text-[10.5px] text-slate-400">{unitLabel(p.unit)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CurrentLevel({ id, unit }: { id: string; unit: string }) {
  const levels = useUi((s) => s.levels);
  return (
    <span className="w-[80px] text-right text-[11px] tabular-nums text-slate-400">
      acum {fmtQty(levelOf(levels, id))} {unitLabel(unit)}
    </span>
  );
}

const toLines = (v: Record<string, string>, allowZero = false) =>
  Object.entries(v)
    .filter(([, s]) => s !== "" && (allowZero ? Number(s) >= 0 : Number(s) > 0))
    .map(([productId, s]) => ({ productId, qty: Math.round(Number(s) * 1000) / 1000 }));

function ReceiptModal({ onClose }: { onClose: () => void }) {
  const stockMove = useUi((s) => s.stockMove);
  const [value, setValue] = useState<Record<string, string>>({});
  const [supplier, setSupplier] = useState("");
  const [doc, setDoc] = useState("");
  const [busy, setBusy] = useState(false);
  const lines = toLines(value);
  const save = async () => {
    if (!lines.length || busy) return;
    setBusy(true);
    const ok = await stockMove({ type: "intrare", lines, note: [supplier && `Furnizor: ${supplier}`, doc && `Doc. ${doc}`].filter(Boolean).join(" · ") || "Intrare marfă" });
    setBusy(false);
    if (ok) {
      useUi.getState().notify(`Intrare înregistrată: ${lines.length} produse.`);
      onClose();
    }
  };
  return (
    <Modal title="Intrare marfă" onClose={onClose} onSubmit={() => void save()} width={640}>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Field label="Furnizor">
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="ex. Agro-Sud SRL" className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12.5px] outline-none focus:border-blue-400" />
        </Field>
        <Field label="Nr. document (factură furnizor)">
          <input value={doc} onChange={(e) => setDoc(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12.5px] outline-none focus:border-blue-400" />
        </Field>
      </div>
      <Field label="Cantitățile primite">
        <QtyList value={value} onChange={setValue} current />
      </Field>
      <ModalButtons onClose={onClose} onSave={() => void save()} disabled={!lines.length || busy} label={busy ? "Se salvează…" : `Înregistrează intrarea (${lines.length})`} />
    </Modal>
  );
}

function CountModal({ onClose }: { onClose: () => void }) {
  const stockMove = useUi((s) => s.stockMove);
  const levels = useUi((s) => s.levels);
  const [value, setValue] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const lines = toLines(value, true);
  const save = async () => {
    if (!lines.length || busy) return;
    setBusy(true);
    const ok = await stockMove({ type: "corectie", lines, note: "Inventariere" });
    setBusy(false);
    if (ok) {
      useUi.getState().notify(`Inventar salvat pentru ${lines.length} produse.`);
      onClose();
    }
  };
  return (
    <Modal title="Inventariere" onClose={onClose} onSubmit={() => void save()} width={640}>
      <p className="mb-3 text-[12px] text-slate-500">Scrieți cantitatea numărată în depozit. Doar produsele completate se schimbă; celelalte rămân cum sunt.</p>
      <QtyList value={value} onChange={setValue} placeholder={(p) => String(Math.round(levelOf(levels, p.id)))} />
      <ModalButtons onClose={onClose} onSave={() => void save()} disabled={!lines.length || busy} label={busy ? "Se salvează…" : `Salvează inventarul (${lines.length})`} />
    </Modal>
  );
}

const slug = (s: string) =>
  `p-${normalize(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)}`;
const COLORS = ["#8cc56b", "#f08a24", "#e2483d", "#7fb2f0", "#f4dc7c", "#c2504a", "#efe6d2", "#9fb7cf", "#b98a4f", "#e9cf7d"];

function ProductsModal({ onClose }: { onClose: () => void }) {
  const saveProducts = useUi((s) => s.saveProducts);
  const productsSaved = useUi((s) => s.productsSaved);
  const [list, setList] = useState<Product[]>(() => PRODUCTS.map((p) => ({ ...p })));
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const update = (i: number, patch: Partial<Product>) => setList((l) => l.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const add = () => {
    setList((l) => [...l, { id: "", name: "", zone: "dry", unit: "kg", stock: 0, min: 0, color: COLORS[l.length % COLORS.length] }]);
    setEditing(list.length);
  };
  const valid = list.every((p) => p.name.trim());
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const used = new Set<string>();
    const out = list.map((p) => {
      let id = p.id || slug(p.name);
      while (used.has(id)) id += "-2";
      used.add(id);
      return { ...p, id, name: p.name.trim() };
    });
    const ok = await saveProducts(out);
    setBusy(false);
    if (ok) {
      useUi.getState().notify("Lista de produse a fost salvată.");
      onClose();
    }
  };
  return (
    <Modal title="Produse" onClose={onClose} onSubmit={() => void save()} width={720}>
      <p className="mb-3 text-[12px] text-slate-500">Lista de produse folosită la comenzi și în stoc. Zona arată de unde se încarcă: beci, frigider sau produse uscate (rampă). Mai târziu lista va veni din 1C.</p>
      <div className="max-h-[52vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">
        {list.map((p, i) =>
          editing === i ? (
            <div key={i} className="grid grid-cols-2 gap-2 bg-blue-50/50 p-2 sm:grid-cols-[1fr_120px_80px_90px_auto]">
              <input autoFocus value={p.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Denumire" className="col-span-2 h-8 rounded-md border border-slate-200 px-2 text-[12px] sm:col-span-1" />
              <select value={p.zone} onChange={(e) => update(i, { zone: e.target.value as Product["zone"] })} className="h-8 rounded-md border border-slate-200 px-1 text-[12px]">
                {(["cellar", "cold", "dry"] as const).map((z) => (
                  <option key={z} value={z}>
                    {ZONE_LABEL[z]}
                  </option>
                ))}
              </select>
              <select value={p.unit} onChange={(e) => update(i, { unit: e.target.value as Product["unit"] })} className="h-8 rounded-md border border-slate-200 px-1 text-[12px]">
                <option value="kg">kg</option>
                <option value="l">l</option>
                <option value="pcs">buc</option>
              </select>
              <input inputMode="decimal" value={String(p.min)} onChange={(e) => update(i, { min: Number(e.target.value.replace(",", ".")) || 0 })} title="Stoc minim" className="h-8 rounded-md border border-slate-200 px-2 text-right text-[12px]" />
              <button onClick={() => setEditing(null)} className="h-8 rounded-md bg-blue-600 px-3 text-[12px] font-medium text-white">
                Gata
              </button>
            </div>
          ) : (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-[12px]">
              <span className="h-3 w-3 rounded" style={{ background: p.color }} />
              <span className="flex-1 font-medium text-slate-800">{p.name || <span className="text-rose-500">fără nume</span>}</span>
              <span className="w-24 text-slate-500">{ZONE_SHORT[p.zone]}</span>
              <span className="w-10 text-slate-500">{unitLabel(p.unit)}</span>
              <span className="w-20 text-right tabular-nums text-slate-400">min {fmtQty(p.min)}</span>
              <button aria-label="Modifică" onClick={() => setEditing(i)} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-700">
                <Pencil size={13} />
              </button>
              <button aria-label="Șterge" onClick={() => confirm(`Ștergeți „${p.name}” din listă? Comenzile vechi îl păstrează.`) && setList((l) => l.filter((_, k) => k !== i))} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 size={13} />
              </button>
            </div>
          ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={add} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
          <Plus size={13} /> Produs nou
        </button>
        {productsSaved && (
          <button onClick={() => confirm("Reveniți la lista inițială de produse?") && setList(BUILTIN_PRODUCTS.map((p) => ({ ...p })))} className="text-[11.5px] text-slate-400 hover:text-slate-700">
            Lista inițială
          </button>
        )}
      </div>
      <ModalButtons onClose={onClose} onSave={() => void save()} disabled={!valid || busy} label={busy ? "Se salvează…" : "Salvează lista"} />
    </Modal>
  );
}

function ModalButtons({ onClose, onSave, disabled, label }: { onClose: () => void; onSave: () => void; disabled: boolean; label: string }) {
  return (
    <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
      <button onClick={onClose} className="rounded-lg px-3 py-2 text-[12.5px] text-slate-600 hover:bg-slate-100">
        Închide
      </button>
      <button disabled={disabled} onClick={onSave} className="rounded-lg bg-blue-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
        {label}
      </button>
    </div>
  );
}
