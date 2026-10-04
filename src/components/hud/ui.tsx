import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/70 bg-white/90 shadow-[0_8px_30px_-12px_rgba(31,63,179,0.25)] backdrop-blur ${className}`}>{children}</div>;
}

export type Tone = "blue" | "green" | "amber" | "gray" | "violet" | "red";
const TONES: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
};
const BARS: Record<Tone, string> = { blue: "bg-blue-500", green: "bg-emerald-500", amber: "bg-amber-400", gray: "bg-slate-400", violet: "bg-violet-500", red: "bg-rose-500" };

export function Chip({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

export function Bar({ value, tone = "blue", className = "" }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div className={`h-full rounded-full transition-[width] duration-500 ${BARS[tone]}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[12px]">
      <span className="text-slate-500">{k}</span>
      <span className="text-right font-medium text-slate-800">{v}</span>
    </div>
  );
}
