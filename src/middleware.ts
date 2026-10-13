/**
 * Simple access control for an internet-facing install (HTTP Basic auth, set via environment):
 *   APP_PASSWORD     office password: full access (any user name)
 *   DRIVER_PASSWORD  user "sofer": only the driver page and what it needs
 *   GPS_INGEST_TOKEN when set, POST /api/gps is checked by its bearer token instead of a password
 * With no passwords set (local development) everything is open.
 */
import { NextResponse, type NextRequest } from "next/server";

const DRIVER_PATHS = [/^\/sofer(\/|$)/, /^\/api\/events$/, /^\/api\/driver\//, /^\/_next\//, /^\/icon\.svg/, /^\/manifest\.webmanifest$/];

function credentials(req: NextRequest): { user: string; pass: string } | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Basic ")) return null;
  try {
    const raw = atob(h.slice(6));
    const i = raw.indexOf(":");
    return i < 0 ? null : { user: raw.slice(0, i), pass: raw.slice(i + 1) };
  } catch {
    return null;
  }
}

/** Tell the API routes who is calling (used to mark suggestions as from the office or a driver). */
function withRole(req: NextRequest, role: "office" | "driver") {
  const headers = new Headers(req.headers);
  headers.set("x-np-role", role);
  return NextResponse.next({ request: { headers } });
}

const challenge = () => new NextResponse("Autentificare necesară", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Nobil Prest", charset="UTF-8"' } });

export function middleware(req: NextRequest) {
  const office = process.env.APP_PASSWORD;
  const driver = process.env.DRIVER_PASSWORD;
  const { pathname } = req.nextUrl;
  // Health check for Docker/monitoring: open, shows only the version.
  if (pathname === "/api/health") return NextResponse.next();
  if (!office && !driver) return withRole(req, "office");

  // The GPS provider authenticates with its own token (checked in the route).
  if (pathname === "/api/gps" && req.method === "POST" && process.env.GPS_INGEST_TOKEN) return NextResponse.next();

  const c = credentials(req);
  if (!c) return challenge();
  if (office && c.pass === office) return withRole(req, "office");
  if (driver && c.user.toLowerCase() === "sofer" && c.pass === driver) {
    // Drivers also need to read the plan (GET /api/state) and may send suggestions (POST /api/feedback).
    if (DRIVER_PATHS.some((r) => r.test(pathname)) || (pathname === "/api/state" && req.method === "GET") || (pathname === "/api/feedback" && req.method === "POST")) {
      return withRole(req, "driver");
    }
    if (pathname === "/") return NextResponse.redirect(new URL("/sofer", req.url));
    return new NextResponse("Acces doar la pagina Șofer", { status: 403 });
  }
  return challenge();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
