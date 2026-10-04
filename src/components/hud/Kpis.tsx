"use client";

import { CheckCircle2, Clock, PackageX, Truck } from "lucide-react";
import { PRODUCTS } from "@/lib/seed";
import { fleetSummary } from "@/lib/sim";
import { useMinute, useTrucks } from "@/lib/store";
import { Card } from "./ui";

export function Kpis() {
  const t = useMinute();
  const trucks = useTrucks();
  const f = fleetSummary(trucks, t);
  const low = PRODUCTS.filter((p) => p.stock < p.min).length;
  const items = [
    { icon: CheckCircle2, label: "Livrate azi", value: `${f.delivered}`, sub: `din ${f.planned} opriri · ${(f.kgDelivered / 1000).toFixed(1)} t` },
    { icon: Truck, label: "Mașini pe drum", value: `${f.onRoad}`, sub: `${f.atWarehouse} la depozit` },
    { icon: Clock, label: "La timp", value: `${f.onTimePct.toFixed(1)}%`, sub: "livrate până la 18:00" },
    { icon: PackageX, label: "Stoc redus", value: `${low}`, sub: "produse sub minim", warn: low > 0 },
  ];
  return (
    <div className="pointer-events-auto flex max-w-[calc(100vw-80px)] gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
      {items.map(({ icon: Icon, label, value, sub, warn }) => (
        <Card key={label} className="flex min-w-[150px] shrink-0 items-center gap-2.5 px-3 py-2">
          <div className={`grid h-8 w-8 place-items-center rounded-lg ${warn ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
            <Icon size={16} />
          </div>
          <div className="leading-tight">
            <div className="text-[10.5px] text-slate-500">{label}</div>
            <div className="text-[17px] font-semibold tabular-nums text-slate-900">{value}</div>
            <div className="text-[10px] text-slate-400">{sub}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
