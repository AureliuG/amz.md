/** Input checks shared by the API routes (the PHP version in deploy/gazduire/api.php mirrors them). */
import type { DayPlan, Order, OrderLine, StockMove } from "@/lib/types";

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Order or stock lines: 1–300 products with a positive quantity. */
export function cleanLines(v: unknown, allowZero = false): OrderLine[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > 300) return null;
  const out: OrderLine[] = [];
  for (const l of v) {
    const productId = typeof l?.productId === "string" ? l.productId.slice(0, 64) : "";
    const qty = l?.qty;
    if (!productId || !isNum(qty) || qty < 0 || (!allowZero && qty === 0) || qty > 1e6) return null;
    out.push({ productId, qty: Math.round(qty * 1000) / 1000 });
  }
  return out;
}

const SOURCES = new Set(["telefon", "test", "1c"]);

/** The editable part of an order as sent by the Comenzi page. */
export function cleanOrderInput(b: Record<string, unknown> | null): Pick<Order, "institutionId" | "date" | "lines" | "note" | "source" | "invoiceNo"> | null {
  if (!b || typeof b.institutionId !== "string" || !b.institutionId || typeof b.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return null;
  const lines = cleanLines(b.lines);
  if (!lines) return null;
  return {
    institutionId: b.institutionId.slice(0, 64),
    date: b.date,
    lines,
    note: clip(b.note, 500) || undefined,
    source: SOURCES.has(String(b.source)) ? (b.source as Order["source"]) : "telefon",
    invoiceNo: clip(b.invoiceNo, 40) || undefined,
  };
}

export function cleanPlan(v: unknown, date: string): DayPlan | null {
  const p = v as DayPlan | null;
  if (!p || !Array.isArray(p.routes) || p.routes.length > 100) return null;
  const routes: DayPlan["routes"] = [];
  for (const r of p.routes) {
    if (!Number.isInteger(r?.truck) || r.truck < 1 || !Array.isArray(r.orderIds) || r.orderIds.length > 500 || !r.orderIds.every((x: unknown) => typeof x === "string")) return null;
    routes.push({ truck: r.truck, orderIds: r.orderIds.map((x: string) => x.slice(0, 64)) });
  }
  const loaded: Record<string, number> = {};
  for (const [k, ts] of Object.entries(p.loaded ?? {})) if (/^\d+$/.test(k) && isNum(ts)) loaded[k] = ts;
  return { date, routes, approved: !!p.approved, loaded, updatedAt: Date.now() };
}

const MOVE_TYPES = new Set(["intrare", "iesire", "corectie"]);

export function cleanMove(v: unknown): Omit<StockMove, "id" | "ts"> | null {
  const m = v as StockMove | null;
  if (!m || !MOVE_TYPES.has(m.type)) return null;
  const lines = cleanLines(m.lines, m.type === "corectie");
  if (!lines) return null;
  return { type: m.type, lines, note: clip(m.note, 300) || undefined, ref: clip(m.ref, 80) || undefined };
}
