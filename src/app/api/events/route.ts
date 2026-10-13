/**
 * Delivery confirmations from drivers (Șofer page).
 * POST { orderNo, truck, status: "arrived" | "delivered" | "problem", reason? }
 * GET  ?day=YYYY-MM-DD → { confirmations: { [orderNo]: latest } }
 */
import { NextResponse } from "next/server";
import { appendLog, dayOf, isDay, readLog } from "@/lib/server/db";
import type { Confirmation } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES = new Set(["arrived", "delivered", "problem"]);

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Partial<Confirmation> | null;
  if (!b || typeof b.orderNo !== "string" || !b.orderNo || !STATUSES.has(String(b.status)) || !Number.isInteger(Number(b.truck))) {
    return NextResponse.json({ error: "orderNo, truck and status are required" }, { status: 400 });
  }
  const c: Confirmation = { orderNo: b.orderNo.slice(0, 64), truck: Number(b.truck), status: b.status!, reason: b.reason ? String(b.reason).slice(0, 200) : undefined, ts: Date.now() };
  await appendLog("events", dayOf(c.ts), [c]);
  return NextResponse.json({ ok: true, confirmation: c });
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("day");
  const day = isDay(q) ? q : dayOf();
  const latest: Record<string, Confirmation> = {};
  for (const c of await readLog<Confirmation>("events", day)) latest[c.orderNo] = c;
  return NextResponse.json({ day, confirmations: latest }, { headers: { "Cache-Control": "no-store" } });
}
