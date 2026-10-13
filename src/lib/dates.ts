/** Calendar helpers. Days are "YYYY-MM-DD" strings in local (Moldova) time. */

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoDay(new Date());
export const parseDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
export const addDays = (iso: string, n: number) => {
  const d = parseDay(iso);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
export const isWeekend = (iso: string) => [0, 6].includes(parseDay(iso).getDay());
/** Next delivery day after `iso` (deliveries run Monday to Friday). */
export const nextWorkday = (iso: string) => {
  let d = addDays(iso, 1);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
};
export const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);

const WD = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];
const WD_SHORT = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sâ"];

/** "Azi", "Mâine", "Poimâine", "Ieri" or "Joi, 15.10". */
export function dayLabel(iso: string, today = todayIso()) {
  const k = daysBetween(today, iso);
  if (k === 0) return "Azi";
  if (k === 1) return "Mâine";
  if (k === 2) return "Poimâine";
  if (k === -1) return "Ieri";
  return `${WD[parseDay(iso).getDay()]}, ${shortDate(iso)}`;
}
export const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
export const weekdayShort = (iso: string) => WD_SHORT[parseDay(iso).getDay()];
export const longDate = (iso: string) => parseDay(iso).toLocaleDateString("ro-MD", { weekday: "long", day: "numeric", month: "long" });
