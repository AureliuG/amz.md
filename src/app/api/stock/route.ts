/**
 * Stock levels, movements and the product list.
 * GET  → { levels, products, moves }   (levels/products null until first saved; moves newest first, last 300)
 * POST { action: "move", move: { type: "intrare"|"iesire"|"corectie", lines, note?, ref? }, base? }
 *        intrare adds, iesire takes out, corectie sets the counted quantity. `base` = starting levels the first time.
 *        A move with a `ref` already applied is ignored (a truck's loading is never taken out twice).
 * POST { action: "products", products }  → saves the product list (null = back to the built-in list)
 */
import { NextResponse } from "next/server";
import { readJson, updateJson, writeJson } from "@/lib/server/db";
import { cleanMove, clip, isNum, newId } from "@/lib/server/validate";
import type { Product, StockMove } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Levels = Record<string, number>;
const ZONES = new Set(["cellar", "cold", "dry"]);
const UNITS = new Set(["kg", "l", "pcs"]);

export async function GET() {
  const [stock, products, moves] = await Promise.all([
    readJson<{ levels: Levels } | null>("stock.json", null),
    readJson<Product[] | null>("products.json", null),
    readJson<StockMove[]>("stock-moves.json", []),
  ]);
  return NextResponse.json({ levels: stock?.levels ?? null, products, moves: moves.slice(-300).reverse() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });

  if (b.action === "move") {
    const m = cleanMove(b.move);
    if (!m) return NextResponse.json({ error: "invalid move" }, { status: 400 });
    if (m.ref && (await readJson<StockMove[]>("stock-moves.json", [])).some((x) => x.ref === m.ref)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    const base: Levels = {};
    for (const [k, v] of Object.entries((b.base ?? {}) as Levels)) if (isNum(v)) base[k.slice(0, 64)] = v;
    const move: StockMove = { id: newId("M"), ts: Date.now(), ...m };
    const next = await updateJson<{ levels: Levels | null }>("stock.json", { levels: null }, (cur) => {
      const levels = { ...(cur?.levels ?? base) };
      for (const l of move.lines) {
        const have = levels[l.productId] ?? 0;
        levels[l.productId] = Math.round((move.type === "intrare" ? have + l.qty : move.type === "iesire" ? have - l.qty : l.qty) * 1000) / 1000;
      }
      return { levels, updatedAt: Date.now() } as { levels: Levels };
    });
    await updateJson<StockMove[]>("stock-moves.json", [], (list) => [...list, move].slice(-5000));
    return NextResponse.json({ ok: true, move, levels: next.levels });
  }

  if (b.action === "products") {
    if (b.products === null) {
      await writeJson("products.json", null);
      return NextResponse.json({ ok: true });
    }
    if (!Array.isArray(b.products) || b.products.length > 2000) return NextResponse.json({ error: "invalid products" }, { status: 400 });
    const products: Product[] = [];
    for (const p of b.products as Product[]) {
      const id = clip(p?.id, 64);
      const name = clip(p?.name, 120);
      if (!id || !name || !ZONES.has(p.zone) || !UNITS.has(p.unit) || !isNum(p.min) || !isNum(p.stock)) {
        return NextResponse.json({ error: `invalid product ${id || "?"}` }, { status: 400 });
      }
      products.push({ id, name, zone: p.zone, unit: p.unit, min: p.min, stock: p.stock, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "#cbd5e1" });
    }
    await writeJson("products.json", products);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
