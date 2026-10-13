/**
 * Where an order is in the cycle: registered → in a route → loaded → on the road → delivered.
 * Facts win over the plan: a driver's "Livrat"/"Problemă" and the warehouse's "Încărcată" come first;
 * otherwise today's stage follows the schedule (marked as "după plan").
 */
import type { DayResult } from "./planner";
import type { Confirmation, Order, Stop, Truck } from "./types";
import type { Tone } from "@/components/hud/ui";

export type Stage = "anulata" | "neplanificata" | "planificata" | "incarcata" | "pe-drum" | "livrata" | "livrata-plan" | "problema" | "neconfirmata";

export const STAGE: Record<Stage, { label: string; tone: Tone; hint: string }> = {
  anulata: { label: "Anulată", tone: "gray", hint: "Comanda a fost anulată." },
  neplanificata: { label: "Neplanificată", tone: "red", hint: "Nu este în nicio mașină: nu încape sau a venit după aprobarea traseelor." },
  planificata: { label: "În traseu", tone: "blue", hint: "Are mașină și oră de sosire." },
  incarcata: { label: "Încărcată", tone: "violet", hint: "Depozitul a confirmat încărcarea mașinii." },
  "pe-drum": { label: "Pe drum", tone: "blue", hint: "Mașina a plecat spre instituție." },
  livrata: { label: "Livrată ✓", tone: "green", hint: "Șoferul a confirmat livrarea." },
  "livrata-plan": { label: "Livrată (după plan)", tone: "green", hint: "Ora planificată a trecut; șoferul nu a confirmat încă." },
  problema: { label: "Problemă", tone: "red", hint: "Șoferul a raportat o problemă." },
  neconfirmata: { label: "Fără confirmare", tone: "amber", hint: "Ziua a trecut și șoferul nu a confirmat livrarea." },
};

export interface Placement {
  truck: Truck;
  stop: Stop;
  index: number;
}

/** Order id → its vehicle and stop. */
export function placements(r: DayResult): Map<string, Placement> {
  const m = new Map<string, Placement>();
  r.trucks.forEach((truck) => truck.stops.forEach((stop, index) => m.set(stop.orderId, { truck, stop, index })));
  return m;
}

export function stageOf(o: Order, place: Placement | undefined, r: DayResult, ctx: { today: string; t: number; conf: Record<string, Confirmation> }): Stage {
  if (o.status === "anulata") return "anulata";
  const c = r.date === ctx.today ? ctx.conf[o.no] : undefined;
  if (c?.status === "problem") return "problema";
  if (c?.status === "delivered") return "livrata";
  if (!place) return "neplanificata";
  if (r.date < ctx.today) return "neconfirmata";
  const loaded = !!r.saved?.loaded[place.truck.number];
  if (r.date > ctx.today) return loaded ? "incarcata" : "planificata";
  if (ctx.t >= place.stop.leaveAt) return "livrata-plan";
  if (ctx.t >= place.truck.departAt) return "pe-drum";
  return loaded ? "incarcata" : "planificata";
}
