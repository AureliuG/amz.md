/**
 * Institution import from Excel/CSV (e.g. a 1C export of contragenți).
 * Headers are matched by name in Romanian, Russian or English; the user can correct the mapping.
 */
import { DELIVER_BY, findTown, insideMoldova, normalize } from "./seed";
import type { Institution, InstitutionType, LngLat } from "./types";

export type Field = "name" | "address" | "town" | "lat" | "lng" | "coords" | "phone" | "code" | "type";
export type Mapping = Partial<Record<Field, number>>;

export const FIELD_LABEL: Record<Field, string> = {
  name: "Denumire",
  address: "Adresă",
  town: "Localitate",
  lat: "Latitudine",
  lng: "Longitudine",
  coords: "Coordonate (lat, lng)",
  phone: "Telefon",
  code: "Cod 1C",
  type: "Tip",
};

const HINTS: Record<Field, string[]> = {
  name: ["denumire", "nume", "institutie", "client", "contragent", "beneficiar", "name", "наименование", "название", "контрагент"],
  address: ["adresa", "address", "adresa livrare", "адрес"],
  town: ["localitate", "oras", "sat", "raion", "town", "city", "населенный пункт", "город", "село"],
  lat: ["lat", "latitudine", "latitude", "широта"],
  lng: ["lng", "lon", "long", "longitudine", "longitude", "долгота"],
  coords: ["coordonate", "coordinates", "gps", "координаты"],
  phone: ["telefon", "tel", "phone", "телефон"],
  code: ["cod", "code", "idno", "код"],
  type: ["tip", "type", "categorie", "тип"],
};

export async function readTable(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  let table: unknown[][];
  if (/\.(xlsx|xlsm)$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    table = (await readSheet(file)) as unknown[][];
  } else {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    table = Papa.parse<string[]>(text, { skipEmptyLines: true }).data;
  }
  const cells = table.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c).trim())));
  // The header is the first row that has at least two non-empty cells.
  const h = cells.findIndex((r) => r.filter(Boolean).length >= 2);
  if (h < 0) return { headers: [], rows: [] };
  return { headers: cells[h], rows: cells.slice(h + 1).filter((r) => r.some(Boolean)) };
}

export function autoMap(headers: string[]): Mapping {
  const m: Mapping = {};
  const norm = headers.map(normalize);
  (Object.keys(HINTS) as Field[]).forEach((f) => {
    const idx = norm.findIndex((h, i) => !Object.values(m).includes(i) && HINTS[f].some((k) => h === k || h.startsWith(k + " ") || h.includes(k)));
    if (idx >= 0) m[f] = idx;
  });
  return m;
}

function guessType(name: string, explicit: string): InstitutionType {
  const n = normalize(`${explicit} ${name}`);
  if (/gradinit|cresa|детск|сад/.test(n)) return "kindergarten";
  if (/scoal|gimnaz|lice|школ|гимназ|лице/.test(n)) return "school";
  if (/spital|sanatate|medical|больниц|медиц/.test(n)) return "hospital";
  if (/penitenciar|detentie|тюрьм|пенитенц/.test(n)) return "prison";
  return "social";
}

const num = (s: string | undefined) => {
  const v = Number(String(s ?? "").replace(",", "."));
  return Number.isFinite(v) && s !== "" ? v : NaN;
};

export interface ImportRow {
  inst: Institution | null;
  name: string;
  town: string;
  address: string;
  precision: "exact" | "town" | "none";
  raw: string[];
}

/** Turn table rows into institutions. Rows without usable coordinates are placed at their town centre when possible. */
export function toInstitutions(rows: string[][], m: Mapping): ImportRow[] {
  const get = (r: string[], f: Field) => (m[f] !== undefined ? (r[m[f]!] ?? "") : "");
  return rows
    .map((r, i): ImportRow => {
      const name = get(r, "name");
      const address = get(r, "address");
      let town = get(r, "town");
      let lat = num(get(r, "lat"));
      let lng = num(get(r, "lng"));
      if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && get(r, "coords")) {
        const [a, b] = get(r, "coords").split(/[;,\s]+/).map((x) => num(x));
        lat = a;
        lng = b;
      }
      // Accept swapped columns (Moldova: lat ≈ 45–49, lng ≈ 26–31).
      if (lat < 35 && lng > 40) [lat, lng] = [lng, lat];
      let pos: LngLat | null = Number.isFinite(lat) && Number.isFinite(lng) && insideMoldova([lng, lat]) ? [lng, lat] : null;
      let precision: ImportRow["precision"] = pos ? "exact" : "none";
      if (!pos) {
        const t = findTown(town) ?? findTown(address);
        if (t) {
          // Spread institutions of the same town slightly so they don't stack on one point.
          const a = (i * 2.399) % (Math.PI * 2);
          const d = 0.004 + ((i * 7) % 10) * 0.0012;
          pos = [t.pos[0] + Math.cos(a) * d * 1.4, t.pos[1] + Math.sin(a) * d];
          precision = "town";
          town = town || t.name;
        }
      }
      const inst: Institution | null =
        name && pos
          ? {
              id: `X${i + 1}`,
              name,
              type: guessType(name, get(r, "type")),
              town: town || "—",
              pos,
              windowEnd: DELIVER_BY,
              precision: precision === "exact" ? "exact" : "town",
              address: address || undefined,
              phone: get(r, "phone") || undefined,
              code: get(r, "code") || undefined,
            }
          : null;
      return { inst, name, town, address, precision: name ? precision : "none", raw: r };
    })
    .filter((x) => x.name);
}

/** Look up an address with OpenStreetMap (Nominatim). Max 1 request per second, per their usage policy. */
export async function geocode(q: string, signal?: AbortSignal): Promise<LngLat | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=md&accept-language=ro&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const j = (await res.json()) as { lat: string; lon: string }[];
  if (!j[0]) return null;
  const p: LngLat = [Number(j[0].lon), Number(j[0].lat)];
  return insideMoldova(p) ? p : null;
}

/** Parse "47.02, 28.90" or a full Google Maps URL (…@47.02,28.90,… or ?q=47.02,28.90). Short maps.app.goo.gl links can't be read from the browser. */
export function parseLocation(text: string): LngLat | null {
  const m = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ?? text.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ?? text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? text.match(/^\s*(-?\d+[.,]\d+)\s*[,;\s]\s*(-?\d+[.,]\d+)\s*$/);
  if (!m) return null;
  let lat = num(m[1]);
  let lng = num(m[2]);
  if (lat < 35 && lng > 40) [lat, lng] = [lng, lat];
  const p: LngLat = [lng, lat];
  return insideMoldova(p) ? p : null;
}

export const TEMPLATE_CSV = "Cod 1C,Denumire,Localitate,Adresa,Telefon,Latitudine,Longitudine\n00123,Grădinița nr. 12 «Licurici»,Chișinău,str. Exemplu 10,+373 22 000 000,47.0245,28.8322\n";
