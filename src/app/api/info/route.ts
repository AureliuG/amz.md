/**
 * Setup status for the "Primii pași" checklist on the Ghid page (office only).
 * Tells what is configured on the server, never the secrets themselves.
 */
import { NextResponse } from "next/server";
import { dataDirStatus, dayOf, listDays, readJson, readLog } from "@/lib/server/db";
import { latestAll } from "@/lib/server/gps";
import type { Feedback, Institution, LngLat, TruckInfo } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const started = Date.now();

export async function GET() {
  const [data, institutions, settings, fleet, gps, eventsToday, eventDays, feedback, orderDays] = await Promise.all([
    dataDirStatus(),
    readJson<Institution[] | null>("institutions.json", null),
    readJson<{ warehouse: LngLat | null }>("settings.json", { warehouse: null }),
    readJson<TruckInfo[] | null>("fleet.json", null),
    latestAll(),
    readLog<unknown>("events", dayOf()),
    listDays("events"),
    readJson<Feedback[]>("feedback.json", []),
    listDays("orders", ".json"),
  ]);
  const day = 24 * 3600_000;
  const fixes = Object.values(gps);
  return NextResponse.json(
    {
      version: APP_VERSION,
      node: process.version,
      uptimeMin: Math.round((Date.now() - started) / 60000),
      data: { writable: data.writable },
      auth: { office: !!process.env.APP_PASSWORD, driver: !!process.env.DRIVER_PASSWORD, gpsToken: !!process.env.GPS_INGEST_TOKEN },
      warehouseSet: !!settings.warehouse,
      fleetSaved: !!fleet?.length,
      fleetCount: fleet?.length ?? 0,
      institutions: institutions?.length ?? 0,
      gps: {
        trackers: fixes.filter((f) => f.source !== "phone").length,
        trackersLastDay: fixes.filter((f) => f.source !== "phone" && Date.now() - f.ts < day).length,
        phonesLastDay: fixes.filter((f) => f.source === "phone" && Date.now() - f.ts < day).length,
      },
      confirmations: { today: eventsToday.length, days: eventDays.length },
      orders: { days: orderDays.length },
      feedback: { total: feedback.length, open: feedback.filter((f) => f.status === "nou" || f.status === "in-lucru").length },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
