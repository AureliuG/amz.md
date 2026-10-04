import { INSTITUTION_BY_ID } from "./seed";
import type { Truck } from "./types";

export type EventKind = "load" | "depart" | "arrive" | "deliver" | "return";

export interface OpsEvent {
  id: string;
  t: number;
  kind: EventKind;
  truckId: string;
  institutionId?: string;
  text: string;
}

/**
 * Everything that has happened today up to `t`, newest first.
 * With live data these become real events (GPS geofences, driver taps, 1C invoices).
 */
export function eventsUntil(trucks: Truck[], t: number, limit = 60): OpsEvent[] {
  const out: OpsEvent[] = [];
  for (const tr of trucks) {
    const push = (time: number, kind: EventKind, text: string, institutionId?: string) => {
      if (time <= t) out.push({ id: `${tr.id}-${kind}-${time.toFixed(2)}`, t: time, kind, truckId: tr.id, institutionId, text });
    };
    push(tr.loadStart, "load", `${tr.label} a început încărcarea la rampa R${tr.dock}`);
    push(tr.departAt, "depart", `${tr.label} a plecat spre ${tr.region}`);
    tr.stops.forEach((s) => {
      const inst = INSTITUTION_BY_ID.get(s.institutionId)!;
      push(s.arriveAt, "arrive", `${tr.label} a ajuns la ${inst.name}`, inst.id);
      push(s.leaveAt, "deliver", `${tr.label} a livrat ${s.weightKg} kg la ${inst.name}`, inst.id);
    });
    push(tr.returnAt, "return", `${tr.label} s-a întors la depozit`);
  }
  return out.sort((a, b) => b.t - a.t).slice(0, limit);
}
