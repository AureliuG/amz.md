/** Latest position per tracker (memory + data/gps-latest.json) and a daily history log (data/gps/<day>.ndjson). */
import { appendLog, dayOf, readJson, writeJson } from "./db";

export interface Pos {
  lat: number;
  lng: number;
  ts: number;
  speed?: number;
  heading?: number;
  source?: "tracker" | "phone";
}

const g = globalThis as unknown as { __gps?: GpsState };
type GpsState = { latest: Map<string, Pos>; loaded: Promise<void>; saveTimer?: ReturnType<typeof setTimeout> };
const state: GpsState = (g.__gps ??= (() => {
  const latest = new Map<string, Pos>();
  const loaded = readJson<Record<string, Pos>>("gps-latest.json", {}).then((saved) => {
    for (const [k, v] of Object.entries(saved)) if (!latest.has(k)) latest.set(k, v);
  });
  return { latest, loaded };
})());

const num = (v: unknown) => (typeof v === "string" ? Number(v.replace(",", ".")) : typeof v === "number" ? v : NaN);

/** Accepts provider-style objects; returns how many were stored and the indexes rejected. */
export async function ingest(items: Record<string, unknown>[], source: Pos["source"] = "tracker") {
  await state.loaded;
  let accepted = 0;
  const rejected: number[] = [];
  const log: (Pos & { tracker: string })[] = [];
  items.slice(0, 5000).forEach((it, i) => {
    const tracker = String(it.tracker ?? it.id ?? it.imei ?? "").trim();
    const lat = num(it.lat ?? it.latitude);
    const lng = num(it.lng ?? it.lon ?? it.longitude);
    const ts = it.ts ? new Date(typeof it.ts === "number" && it.ts < 1e12 ? it.ts * 1000 : (it.ts as string | number)).getTime() : Date.now();
    if (!tracker || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !Number.isFinite(ts)) {
      rejected.push(i);
      return;
    }
    const speed = num(it.speed);
    const heading = num(it.heading ?? it.course);
    const p: Pos = { lat, lng, ts, speed: Number.isFinite(speed) ? speed : undefined, heading: Number.isFinite(heading) ? heading : undefined, source };
    log.push({ tracker, ...p });
    accepted++;
    const prev = state.latest.get(tracker);
    if (!prev || prev.ts <= ts) state.latest.set(tracker, p);
  });
  // History grouped by day; the latest snapshot is saved a moment later to batch bursts.
  const byDay = new Map<string, typeof log>();
  log.forEach((p) => byDay.set(dayOf(p.ts), [...(byDay.get(dayOf(p.ts)) ?? []), p]));
  await Promise.all([...byDay].map(([day, list]) => appendLog("gps", day, list)));
  if (!state.saveTimer) {
    state.saveTimer = setTimeout(() => {
      state.saveTimer = undefined;
      void writeJson("gps-latest.json", Object.fromEntries(state.latest));
    }, 2000);
  }
  return { accepted, rejected };
}

export async function latestAll() {
  await state.loaded;
  return Object.fromEntries(state.latest);
}
