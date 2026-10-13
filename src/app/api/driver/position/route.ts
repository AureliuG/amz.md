/** Position from a driver's phone (Șofer page), for trucks whose tracker doesn't report. */
import { NextResponse } from "next/server";
import { readJson } from "@/lib/server/db";
import { ingest } from "@/lib/server/gps";
import { DEFAULT_FLEET } from "@/lib/seed";
import type { TruckInfo } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { truck?: number; lat?: number; lng?: number; speed?: number; heading?: number } | null;
  const n = Number(body?.truck);
  if (!body || !Number.isInteger(n) || n < 1) return NextResponse.json({ error: "truck required" }, { status: 400 });
  const fleet = await readJson<TruckInfo[] | null>("fleet.json", null);
  // Use the truck's tracker ID so the dashboard needs no extra mapping; fall back to "T<n>".
  const tracker = (fleet ?? DEFAULT_FLEET).find((f) => f.number === n)?.trackerId || `T${n}`;
  return NextResponse.json(await ingest([{ tracker, lat: body.lat, lng: body.lng, speed: body.speed, heading: body.heading }], "phone"));
}
