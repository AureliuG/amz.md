"use client";

import { CalendarDays } from "lucide-react";
import { nextWorkday, shortDate, weekdayShort } from "@/lib/dates";

/** Today, the next two delivery days, or any date. */
export function DayPicker({ date, today, onChange }: { date: string; today: string; onChange: (d: string) => void }) {
  const tomorrow = nextWorkday(today);
  const after = nextWorkday(tomorrow);
  const quick = [today, tomorrow, after];
  return (
    <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
      {quick.map((d) => (
        <button key={d} onClick={() => onChange(d)} className={`rounded-lg px-2.5 py-1 text-[12px] font-medium ${date === d ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
          {d === today ? "Azi" : `${weekdayShort(d)} ${shortDate(d)}`}
        </button>
      ))}
      <label className="relative flex cursor-pointer items-center rounded-lg px-2 py-1 text-slate-500 hover:text-slate-800" title="Altă zi">
        <CalendarDays size={15} />
        <input type="date" value={date} onChange={(e) => e.target.value && onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  );
}
