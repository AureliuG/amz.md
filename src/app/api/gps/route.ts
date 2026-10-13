/**
 * GPS intake. The GPS provider (or a small connector polling its API) POSTs positions here;
 * the dashboard polls GET for the latest position of each tracker.
 *
 * POST /api/gps   body: one position or an array of positions
 *   { "tracker": "059166", "lat": 47.02, "lng": 28.83, "ts": "2026-10-12T08:15:00Z", "speed": 42, "heading": 180 }
 *   If GPS_INGEST_TOKEN is set, send header  Authorization: Bearer <token>
 * GET  /api/gps                      → { positions: { [tracker]: { lat, lng, ts, speed, heading } } }
 * GET  /api/gps?tracker=059166&day=2026-10-13 → { points: [...] }  (that tracker's track for the day)
 */
import { NextResponse } from "next/server";
import { dayOf, isDay, readLog } from "@/lib/server/db";
import { ingest, latestAll } from "@/lib/server/gps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = process.env.GPS_INGEST_TOKEN;
  if (token && req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const items = (Array.isArray(body) ? body : [body]) as Record<string, unknown>[];
  return NextResponse.json(await ingest(items, "tracker"));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tracker = url.searchParams.get("tracker");
  if (tracker) {
    const day = isDay(url.searchParams.get("day")) ? url.searchParams.get("day")! : dayOf();
    const points = (await readLog<{ tracker: string; lat: number; lng: number; ts: number }>("gps", day)).filter((p) => p.tracker === tracker);
    return NextResponse.json({ tracker, day, points }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ positions: await latestAll(), serverTime: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
