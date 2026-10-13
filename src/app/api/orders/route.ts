/**
 * Orders (Comenzi), one file per delivery day: data/orders/<YYYY-MM-DD>.json.
 * GET  ?date=YYYY-MM-DD                                → { date, orders }
 * POST { action: "create", order }                      → { order }   (number CMD-00001… is given here)
 * POST { action: "update", id, date, patch }            → { order }   (patch.date moves it to another day)
 * POST { action: "bulk", orders }                       → { created } (test orders, up to 1500)
 * POST { action: "delete-test", date }                  → { removed }
 * Only GET and POST, because some web hosts block PUT/DELETE.
 */
import { NextResponse } from "next/server";
import { dayOf, isDay, readJson, updateJson } from "@/lib/server/db";
import { clip, cleanLines, cleanOrderInput, newId } from "@/lib/server/validate";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const file = (date: string) => `orders/${date}.json`;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Reserve `count` consecutive order numbers. */
async function numbers(count: number): Promise<string[]> {
  const c = await updateJson<{ n: number }>("orders-counter.json", { n: 0 }, (cur) => ({ n: (cur?.n ?? 0) + count }));
  return Array.from({ length: count }, (_, i) => `CMD-${String(c.n - count + 1 + i).padStart(5, "0")}`);
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("date");
  const date = isDay(q) ? q : dayOf();
  return NextResponse.json({ date, orders: await readJson<Order[]>(file(date), []) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return bad("invalid JSON");

  if (b.action === "create") {
    const input = cleanOrderInput(b.order as Record<string, unknown>);
    if (!input) return bad("Comanda nu este completă (instituția, data și cel puțin un produs).");
    const [no] = await numbers(1);
    const order: Order = { id: newId("O"), no, ...input, status: "noua", createdAt: Date.now() };
    await updateJson<Order[]>(file(order.date), [], (list) => [...list, order]);
    return NextResponse.json({ ok: true, order });
  }

  if (b.action === "bulk") {
    const list = Array.isArray(b.orders) ? b.orders.slice(0, 1500).map((o) => cleanOrderInput(o as Record<string, unknown>)) : [];
    if (!list.length || list.some((o) => !o)) return bad("invalid orders");
    const nos = await numbers(list.length);
    const now = Date.now();
    const created = list.map((o, i) => ({ id: newId("O") + i, no: nos[i], ...o!, status: "noua" as const, createdAt: now }));
    const byDate = new Map<string, Order[]>();
    created.forEach((o) => byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]));
    for (const [date, add] of byDate) await updateJson<Order[]>(file(date), [], (cur) => [...cur, ...add]);
    return NextResponse.json({ ok: true, created: created.length });
  }

  if (b.action === "update") {
    const id = clip(b.id, 64);
    const date = String(b.date ?? "");
    const patch = (b.patch ?? {}) as Record<string, unknown>;
    if (!id || !isDay(date)) return bad("id and date required");
    const lines = patch.lines === undefined ? undefined : cleanLines(patch.lines);
    if (lines === null) return bad("invalid lines");
    if (patch.status !== undefined && patch.status !== "noua" && patch.status !== "anulata") return bad("invalid status");
    const newDate = patch.date === undefined ? date : String(patch.date);
    if (!isDay(newDate)) return bad("invalid date");
    let found: Order | null = null;
    await updateJson<Order[]>(file(date), [], (list) =>
      list.flatMap((o) => {
        if (o.id !== id) return [o];
        found = {
          ...o,
          ...(lines ? { lines } : {}),
          ...(patch.note !== undefined ? { note: clip(patch.note, 500) || undefined } : {}),
          ...(patch.status !== undefined ? { status: patch.status as Order["status"] } : {}),
          ...(patch.invoiceNo !== undefined ? { invoiceNo: clip(patch.invoiceNo, 40) || undefined } : {}),
          ...(typeof patch.institutionId === "string" && patch.institutionId ? { institutionId: patch.institutionId.slice(0, 64) } : {}),
          date: newDate,
        };
        return newDate === date ? [found] : [];
      }),
    );
    if (!found) return bad("not found", 404);
    if (newDate !== date) await updateJson<Order[]>(file(newDate), [], (list) => [...list, found!]);
    return NextResponse.json({ ok: true, order: found });
  }

  if (b.action === "delete-test") {
    const date = String(b.date ?? "");
    if (!isDay(date)) return bad("date required");
    let removed = 0;
    await updateJson<Order[]>(file(date), [], (list) => {
      const keep = list.filter((o) => o.source !== "test");
      removed = list.length - keep.length;
      return keep;
    });
    return NextResponse.json({ ok: true, removed });
  }

  return bad("unknown action");
}
