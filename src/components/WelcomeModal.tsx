"use client";

import { BookOpen, CalendarRange, Database, ListChecks, Map as MapIcon, Sparkles, Warehouse, X } from "lucide-react";
import { useEffect, useState } from "react";
import { APP_VERSION, APP_VERSION_SHORT, CHANGELOG } from "@/lib/version";
import { openGuide } from "./GuideView";

const SEEN_KEY = "nobilprest.seenVersion";

/**
 * First visit: a short welcome. After an update: what's new in this version.
 * Shown once per version and browser.
 */
export function WelcomeModal() {
  const [mode, setMode] = useState<"welcome" | "news" | null>(null);
  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      if (seen !== APP_VERSION) setMode(seen ? "news" : "welcome");
    } catch {
      // Storage blocked: don't nag every time.
    }
  }, []);
  if (!mode) return null;

  const close = (goGuide?: boolean) => {
    try {
      localStorage.setItem(SEEN_KEY, APP_VERSION);
    } catch {
      // ignore
    }
    setMode(null);
    if (goGuide) openGuide(mode === "news" ? "versiune" : "primii-pasi");
  };
  const latest = CHANGELOG[0];

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={mode === "welcome" ? "Bun venit" : "Ce e nou"}>
      <div className="panel-in w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-[#2f6bff] to-[#1f3fb3] px-6 pb-5 pt-6 text-white">
          <button aria-label="Închide" onClick={() => close()} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-blue-100 hover:bg-white/10">
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-blue-100">
            <Sparkles size={14} /> Versiunea {APP_VERSION_SHORT}
          </div>
          <h2 className="mt-1 text-[21px] font-semibold leading-tight">{mode === "welcome" ? "Bun venit în Nobil Prest · Depozit & livrări" : `Ce e nou în versiunea ${APP_VERSION_SHORT}`}</h2>
          <p className="mt-1 text-[13px] text-blue-50">{mode === "welcome" ? "Depozitul, mașinile și livrările către instituții, într-un singur loc." : latest.title}</p>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-5">
          {mode === "welcome" ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(
                [
                  [Warehouse, "Depozit", "Rampele, încărcarea și mașinile în 3D."],
                  [MapIcon, "Moldova", "Unde sunt mașinile și ce s-a livrat."],
                  [ListChecks, "Livrări", "Toate livrările zilei, confirmările șoferilor."],
                  [CalendarRange, "Program", "Ziua pe ore și foile de tipărit."],
                  [Database, "Date", "Depozitul, flota, instituțiile, GPS-ul."],
                  [BookOpen, "Ghid", "Primii pași, întrebări, propuneri."],
                ] as const
              ).map(([Icon, t, d]) => (
                <div key={t} className="flex gap-2.5 rounded-xl bg-slate-50 p-2.5">
                  <Icon size={17} className="mt-0.5 shrink-0 text-blue-600" />
                  <div>
                    <div className="text-[13px] font-semibold text-slate-800">{t}</div>
                    <div className="text-[12px] text-slate-500">{d}</div>
                  </div>
                </div>
              ))}
              <p className="col-span-full mt-1 text-[12px] text-slate-500">
                Comenzile și stocul sunt deocamdată exemple; mașinile și GPS-ul sunt reale. Începeți cu lista „Primii pași” din Ghid.
              </p>
            </div>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-slate-700">
              {latest.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={() => close()} className="rounded-lg px-3 py-1.5 text-[12.5px] text-slate-600 hover:bg-slate-50">
            Mai târziu
          </button>
          <button onClick={() => close(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-blue-700">
            {mode === "welcome" ? "Deschide primii pași" : "Vezi versiunea și ce urmează"}
          </button>
        </div>
      </div>
    </div>
  );
}
