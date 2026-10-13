/** Liveness check for Docker/monitoring. Open without password; reveals only the version. */
import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, version: APP_VERSION });
}
