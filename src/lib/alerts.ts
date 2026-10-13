/**
 * Things the dispatcher should look at, derived from today's plan, stock, GPS and driver reports.
 * Each alert says what is wrong and, where possible, what to do.
 */
import { truckLoadKg } from "./planner";
import { DELIVER_BY, INSTITUTION_BY_ID, PRODUCT_BY_ID, PRODUCTS } from "./seed";
import { fmtTime, truckState } from "./sim";
import { fmtQty, levelOf, unitLabel, type Levels } from "./stock";
import { liveFix, type LivePos } from "./store";
import type { Confirmation, Order, Selection, Truck } from "./types";

export type Severity = "high" | "medium" | "info";

export interface Alert {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  select?: Selection;
}

/** Total quantity of each product on today's trucks. */
export function demandByProduct(trucks: Truck[]): Map<string, number> {
  const m = new Map<string, number>();
  trucks.forEach((tr) => tr.stops.forEach((s) => s.lines.forEach((l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty))));
  return m;
}


export function computeAlerts(
  trucks: Truck[],
  t: number,
  opts: { gpsMode: "sim" | "live"; live: Record<string, LivePos>; confirmations: Record<string, Confirmation>; now: number; levels: Levels | null; unplanned: Order[]; loaded: Record<string, number> },
): Alert[] {
  const out: Alert[] = [];
  const stock = (id: string) => levelOf(opts.levels, id);

  // Driver-reported problems come first: someone is waiting on the phone.
  Object.values(opts.confirmations)
    .filter((c) => c.status === "problem")
    .forEach((c) => {
      const tr = trucks.find((x) => x.number === c.truck);
      const stop = tr?.stops.find((s) => s.orderNo === c.orderNo);
      const inst = stop && INSTITUTION_BY_ID.get(stop.institutionId);
      out.push({
        id: `problem-${c.orderNo}`,
        severity: "high",
        title: `Mașina ${c.truck}: problemă la livrare`,
        detail: `${inst?.name ?? c.orderNo}${c.reason ? ` — ${c.reason}` : ""} (${new Date(c.ts).toLocaleTimeString("ro-MD", { hour: "2-digit", minute: "2-digit" })})`,
        select: inst ? { kind: "institution", id: inst.id } : undefined,
      });
    });

  // Orders with no vehicle today.
  if (opts.unplanned.length) {
    out.push({ id: "unplanned", severity: "high", title: `${opts.unplanned.length} ${opts.unplanned.length === 1 ? "comandă fără mașină" : "comenzi fără mașină"} azi`, detail: "Nu încap sau au venit după aprobarea traseelor. Deschideți Trasee → „Adaugă-le unde încap”." });
  }

  // Stock that cannot cover what is still to be loaded today.
  const demand = demandByProduct(trucks.filter((tr) => !opts.loaded[tr.number]));
  PRODUCTS.forEach((p) => {
    const need = demand.get(p.id) ?? 0;
    if (need > stock(p.id)) {
      out.push({ id: `stock-short-${p.id}`, severity: "high", title: `Stoc insuficient: ${p.name}`, detail: `De încărcat azi ${fmtQty(need)} ${unitLabel(p.unit)}, în stoc ${fmtQty(stock(p.id))} ${unitLabel(p.unit)}.`, select: { kind: "zone", id: p.zone } });
    }
  });

  trucks.forEach((tr) => {
    const select: Selection = { kind: "truck", id: tr.id };
    // Deliveries planned after the 18:00 deadline that haven't happened yet.
    const late = tr.stops.filter((s) => s.arriveAt > DELIVER_BY && t < s.leaveAt);
    if (late.length) {
      const first = INSTITUTION_BY_ID.get(late[0].institutionId);
      out.push({ id: `late-${tr.id}`, severity: "high", title: `${tr.label}: ${late.length} ${late.length === 1 ? "livrare" : "livrări"} după 18:00`, detail: `Prima: ${first?.name ?? "—"}, sosire ~${fmtTime(late[0].arriveAt)}. Mutați opriri pe altă mașină sau plecați mai devreme.`, select });
    }
    const load = truckLoadKg(tr);
    if (load > tr.capacityKg) {
      out.push({ id: `over-${tr.id}`, severity: "medium", title: `${tr.label} supraîncărcată`, detail: `${fmtQty(load)} kg, capacitatea este ${fmtQty(tr.capacityKg)} kg. Mutați o comandă pe altă mașină.`, select });
    }
    // Cold chain: chilled products on a vehicle without refrigeration.
    if (!tr.refrigerated && tr.stops.length) {
      const cold = new Set<string>();
      tr.stops.forEach((s) => s.lines.forEach((l) => PRODUCT_BY_ID.get(l.productId)?.zone === "cold" && cold.add(PRODUCT_BY_ID.get(l.productId)!.name)));
      if (cold.size) {
        const names = [...cold];
        out.push({ id: `cold-${tr.id}`, severity: "medium", title: `${tr.label} nu e frigorifică`, detail: `Are produse refrigerate: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` și încă ${names.length - 3}` : ""}.`, select });
      }
    }
    const st = truckState(tr, t);
    const onRoad = !["parked", "loading", "done"].includes(st.status);
    const phone = liveFix(opts.live, tr);
    if (!tr.gpsOk && tr.stops.length && !(phone && opts.now - phone.ts < 20 * 60_000)) {
      out.push({ id: `nogps-${tr.id}`, severity: "info", title: `${tr.label}: trackerul GPS nu transmite`, detail: "Șoferul poate trimite poziția din telefon, de pe pagina Șofer.", select });
    } else if (opts.gpsMode === "live" && onRoad) {
      const fix = liveFix(opts.live, tr);
      const age = fix ? (opts.now - fix.ts) / 60000 : Infinity;
      if (age > 20) {
        out.push({ id: `stale-${tr.id}`, severity: "medium", title: `${tr.label}: fără poziție GPS ${Number.isFinite(age) ? `de ${Math.round(age)} min` : "azi"}`, detail: "Verificați trackerul sau sunați șoferul.", select });
      }
    }
  });

  // Low stock (not blocking today) last.
  PRODUCTS.forEach((p) => {
    if (stock(p.id) < p.min && !((demand.get(p.id) ?? 0) > stock(p.id))) {
      out.push({ id: `stock-low-${p.id}`, severity: "info", title: `Stoc redus: ${p.name}`, detail: `${fmtQty(stock(p.id))} ${unitLabel(p.unit)}, sub minimul de ${fmtQty(p.min)}. De comandat (pagina Stoc).`, select: { kind: "zone", id: p.zone } });
    }
  });

  const rank: Record<Severity, number> = { high: 0, medium: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
