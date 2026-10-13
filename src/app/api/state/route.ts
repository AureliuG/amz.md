/**
 * Shared settings for every office computer: imported institutions, warehouse location, fleet cards.
 * GET → { institutions, warehouse, fleet }   (null = not set, the app uses its defaults)
 * PATCH { institutions?, warehouse?, fleet? } — send null to reset a part.
 */
import { NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/server/db";
import type { Institution, LngLat, TruckInfo } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [institutions, settings, fleet] = await Promise.all([
    readJson<Institution[] | null>("institutions.json", null),
    readJson<{ warehouse: LngLat | null }>("settings.json", { warehouse: null }),
    readJson<TruckInfo[] | null>("fleet.json", null),
  ]);
  return NextResponse.json({ institutions, warehouse: settings.warehouse, fleet }, { headers: { "Cache-Control": "no-store" } });
}

const isLngLat = (v: unknown): v is LngLat => Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === "number" && Number.isFinite(x));
const isInstitution = (v: unknown) => {
  const i = v as Institution;
  return !!i && typeof i.id === "string" && typeof i.name === "string" && isLngLat(i.pos);
};
const isTruckInfo = (v: unknown) => {
  const t = v as TruckInfo;
  return !!t && Number.isInteger(t.number) && t.number > 0 && typeof t.plate === "string" && Number.isFinite(t.capacityKg);
};

export async function PATCH(req: Request) {
  const b = (await req.json().catch(() => null)) as { institutions?: unknown; warehouse?: unknown; fleet?: unknown } | null;
  if (!b) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  const jobs: Promise<void>[] = [];
  if ("institutions" in b) {
    if (b.institutions !== null && !(Array.isArray(b.institutions) && b.institutions.length <= 20000 && b.institutions.every(isInstitution))) {
      return NextResponse.json({ error: "invalid institutions" }, { status: 400 });
    }
    jobs.push(writeJson("institutions.json", b.institutions));
  }
  if ("warehouse" in b) {
    if (b.warehouse !== null && !isLngLat(b.warehouse)) return NextResponse.json({ error: "invalid warehouse" }, { status: 400 });
    jobs.push(writeJson("settings.json", { warehouse: b.warehouse }));
  }
  if ("fleet" in b) {
    if (b.fleet !== null && !(Array.isArray(b.fleet) && b.fleet.length <= 100 && b.fleet.every(isTruckInfo))) {
      return NextResponse.json({ error: "invalid fleet" }, { status: 400 });
    }
    jobs.push(writeJson("fleet.json", b.fleet));
  }
  await Promise.all(jobs);
  return NextResponse.json({ ok: true });
}
