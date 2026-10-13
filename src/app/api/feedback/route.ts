/**
 * Suggestions, problems and questions ("Propuneri și probleme").
 * POST { name, kind, page, text, priority }        — office and drivers
 * GET  → { items: Feedback[] } newest first         — office
 * PATCH { id, status?, reply? }                     — office (mark as in work / planned / solved)
 * Stored in data/feedback.json.
 */
import { NextResponse } from "next/server";
import { readJson, updateJson } from "@/lib/server/db";
import type { Feedback } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KINDS = new Set(["problema", "propunere", "intrebare"]);
const PRIORITIES = new Set(["mica", "medie", "mare"]);
const STATUSES = new Set(["nou", "in-lucru", "planificat", "rezolvat", "respins"]);
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function GET() {
  const items = await readJson<Feedback[]>("feedback.json", []);
  return NextResponse.json({ items: [...items].sort((a, b) => b.ts - a.ts) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Partial<Feedback> | null;
  const text = clip(b?.text, 4000);
  if (!b || text.length < 3) return NextResponse.json({ error: "Scrieți descrierea (minim 3 caractere)." }, { status: 400 });
  const item: Feedback = {
    id: `F${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    name: clip(b.name, 80) || "Anonim",
    kind: KINDS.has(String(b.kind)) ? (b.kind as Feedback["kind"]) : "propunere",
    page: clip(b.page, 60) || "General",
    text,
    priority: PRIORITIES.has(String(b.priority)) ? (b.priority as Feedback["priority"]) : "medie",
    status: "nou",
    version: APP_VERSION,
    from: req.headers.get("x-np-role") === "driver" ? "sofer" : "birou",
  };
  await updateJson<Feedback[]>("feedback.json", [], (list) => [...list, item].slice(-2000));
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: Request) {
  const b = (await req.json().catch(() => null)) as { id?: string; status?: string; reply?: string } | null;
  if (!b?.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (b.status !== undefined && !STATUSES.has(b.status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
  let found = false;
  await updateJson<Feedback[]>("feedback.json", [], (list) =>
    list.map((f) => {
      if (f.id !== b.id) return f;
      found = true;
      return { ...f, ...(b.status ? { status: b.status as Feedback["status"] } : {}), ...(b.reply !== undefined ? { reply: clip(b.reply, 1000) } : {}) };
    }),
  );
  return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
