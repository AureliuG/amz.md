/**
 * Saved routes of a day (which orders each vehicle carries, approved, loaded): data/plans/<YYYY-MM-DD>.json.
 * GET  ?date=YYYY-MM-DD        → { date, plan }   (null = not saved: the app plans automatically)
 * POST { date, plan }          → { ok }           (plan null = back to automatic)
 */
import { NextResponse } from "next/server";
import { dayOf, isDay, readJson, writeJson } from "@/lib/server/db";
import { cleanPlan } from "@/lib/server/validate";
import type { DayPlan } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("date");
  const date = isDay(q) ? q : dayOf();
  return NextResponse.json({ date, plan: await readJson<DayPlan | null>(`plans/${date}.json`, null) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { date?: string; plan?: unknown } | null;
  if (!b || !isDay(b.date ?? null)) return NextResponse.json({ error: "date required" }, { status: 400 });
  const plan = b.plan === null ? null : cleanPlan(b.plan, b.date!);
  if (b.plan !== null && !plan) return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  await writeJson(`plans/${b.date}.json`, plan);
  return NextResponse.json({ ok: true, plan });
}
