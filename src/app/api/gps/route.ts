/**
 * GPS intake. The GPS provider (or a small connector polling its API) POSTs positions here;
 * the dashboard polls GET for the latest position of each tracker.
 *
 * POST /api/gps   body: one position or an array of positions
 *   { "tracker": "059166", "lat": 47.02, "lng": 28.83, "ts": "2026-10-12T08:15:00Z", "speed": 42, "heading": 180 }
 *   If GPS_INGEST_TOKEN is set, send header  Authorization: Bearer <token>
 * GET  /api/gps   → { positions: { [tracker]: { lat, lng, ts, speed, heading } } }
 *
 * Positions are kept in memory (latest per tracker). History and persistence come with the database.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface Pos {
  lat: number;
  lng: number;
  ts: number;
  speed?: number;
  heading?: number;
}

const g = globalThis as unknown as { __gpsLatest?: Map<string, Pos> };
const latest = (g.__gpsLatest ??= new Map<string, Pos>());

const n = (v: unknown) => (typeof v === "string" ? Number(v.replace(",", ".")) : typeof v === "number" ? v : NaN);

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
  let accepted = 0;
  const rejected: number[] = [];
  items.slice(0, 5000).forEach((it, i) => {
    const tracker = String(it.tracker ?? it.id ?? it.imei ?? "").trim();
    const lat = n(it.lat ?? it.latitude);
    const lng = n(it.lng ?? it.lon ?? it.longitude);
    const ts = it.ts ? new Date(typeof it.ts === "number" && it.ts < 1e12 ? it.ts * 1000 : (it.ts as string | number)).getTime() : Date.now();
    if (!tracker || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !Number.isFinite(ts)) {
      rejected.push(i);
      return;
    }
    const prev = latest.get(tracker);
    if (prev && prev.ts > ts) return; // keep the newest
    latest.set(tracker, { lat, lng, ts, speed: Number.isFinite(n(it.speed)) ? n(it.speed) : undefined, heading: Number.isFinite(n(it.heading ?? it.course)) ? n(it.heading ?? it.course) : undefined });
    accepted++;
  });
  return NextResponse.json({ accepted, rejected });
}

export async function GET() {
  return NextResponse.json({ positions: Object.fromEntries(latest), serverTime: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
