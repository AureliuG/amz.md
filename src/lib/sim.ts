/**
 * Pure functions: the whole operational picture is derived from the plan and the clock.
 * With live data the same functions will read driver GPS and status events instead.
 */
import { arcPoint, bearingDeg } from "./geo";
import { INSTITUTION_BY_ID, WAREHOUSE } from "./seed";
import type { LngLat, Stop, StopStatus, Truck, TruckState } from "./types";

/** Minutes a truck spends crossing the yard between dock and gate. */
export const YARD_MIN = 4;

const stopPos = (s: Stop) => INSTITUTION_BY_ID.get(s.institutionId)!.pos;

export function truckState(truck: Truck, t: number): TruckState {
  const base = { bearing: 0, stopIdx: 0, delivered: 0, progress: 0, minutesLeft: 0, yard: 0 };
  if (t < truck.loadStart) return { ...base, status: "parked", pos: WAREHOUSE, minutesLeft: truck.loadStart - t };
  if (t < truck.departAt) {
    return { ...base, status: "loading", pos: WAREHOUSE, progress: (t - truck.loadStart) / (truck.departAt - truck.loadStart), minutesLeft: truck.departAt - t };
  }
  if (t >= truck.returnAt) return { ...base, status: "done", pos: WAREHOUSE, delivered: truck.stops.length, stopIdx: truck.stops.length, progress: 1 };

  let from: LngLat = WAREHOUSE;
  let legStart = truck.departAt;
  for (let i = 0; i < truck.stops.length; i++) {
    const s = truck.stops[i];
    const to = stopPos(s);
    if (t < s.arriveAt) {
      const p = (t - legStart) / (s.arriveAt - legStart);
      const out = { ...base, status: "driving" as const, pos: arcPoint(from, to, p), bearing: legBearing(from, to, p), stopIdx: i, delivered: i, progress: p, minutesLeft: s.arriveAt - t };
      if (i === 0 && t - truck.departAt < YARD_MIN) return { ...out, status: "departing", yard: (t - truck.departAt) / YARD_MIN };
      return out;
    }
    if (t < s.leaveAt) {
      return { ...base, status: "unloading", pos: to, stopIdx: i, delivered: i, progress: (t - s.arriveAt) / (s.leaveAt - s.arriveAt), minutesLeft: s.leaveAt - t };
    }
    from = to;
    legStart = s.leaveAt;
  }
  const p = (t - legStart) / (truck.returnAt - legStart);
  const out = { ...base, status: "returning" as const, pos: arcPoint(from, WAREHOUSE, p), bearing: legBearing(from, WAREHOUSE, p), stopIdx: truck.stops.length, delivered: truck.stops.length, progress: p, minutesLeft: truck.returnAt - t };
  if (truck.returnAt - t < YARD_MIN) return { ...out, status: "arriving", yard: 1 - (truck.returnAt - t) / YARD_MIN };
  return out;
}

function legBearing(a: LngLat, b: LngLat, p: number) {
  return bearingDeg(arcPoint(a, b, Math.max(0, p - 0.02)), arcPoint(a, b, Math.min(1, p + 0.02)));
}

export function stopStatus(truck: Truck, idx: number, t: number): StopStatus {
  const s = truck.stops[idx];
  if (t >= s.leaveAt) return "delivered";
  if (t >= s.arriveAt) return "unloading";
  const prevLeave = idx === 0 ? truck.departAt : truck.stops[idx - 1].leaveAt;
  return t >= prevLeave ? "next" : "planned";
}

export const isOnTime = (s: Stop) => s.arriveAt <= INSTITUTION_BY_ID.get(s.institutionId)!.windowEnd;

export function fleetSummary(trucks: Truck[], t: number) {
  let delivered = 0;
  let planned = 0;
  let onTime = 0;
  let onRoad = 0;
  let atWarehouse = 0;
  let kgDelivered = 0;
  for (const tr of trucks) {
    const st = truckState(tr, t);
    if (["driving", "unloading", "returning", "departing", "arriving"].includes(st.status)) onRoad++;
    else atWarehouse++;
    tr.stops.forEach((s) => {
      planned++;
      if (t >= s.leaveAt) {
        delivered++;
        kgDelivered += s.weightKg;
        if (isOnTime(s)) onTime++;
      }
    });
  }
  return { delivered, planned, onTimePct: delivered ? (onTime / delivered) * 100 : 100, onRoad, atWarehouse, kgDelivered };
}

export const STATUS_LABEL: Record<TruckState["status"], string> = {
  parked: "Parked",
  loading: "Loading",
  departing: "Leaving yard",
  driving: "En route",
  unloading: "Unloading",
  returning: "Returning",
  arriving: "Entering yard",
  done: "Back · done",
};

export const STATUS_TONE: Record<TruckState["status"], "blue" | "green" | "amber" | "gray" | "violet"> = {
  parked: "gray",
  loading: "amber",
  departing: "blue",
  driving: "blue",
  unloading: "green",
  returning: "violet",
  arriving: "violet",
  done: "gray",
};

export function fmtTime(min: number) {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function fmtDur(min: number) {
  const m = Math.max(0, Math.round(min));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
