/**
 * Demo data. Everything here is generated (deterministically) and will be replaced by
 * data imported from 1C: institutions, orders, products/stock, trucks and drivers.
 */
import border from "./moldova-border.json";
import { bearingDeg, haversineKm, pointInPolygon } from "./geo";
import type { Institution, InstitutionType, LngLat, Order, OrderLine, Product, TruckInfo } from "./types";

/** Warehouse location. PLACEHOLDER in Chișinău until the real coordinates are provided. */
export const WAREHOUSE: LngLat = [28.901, 47.0245];
/** Deliveries are due by 18:00 the delivery day (no per-institution windows). */
export const DELIVER_BY = 18 * 60;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261004);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const between = (a: number, b: number) => a + rand() * (b - a);

// [name, lng, lat, weight, allowed jitter direction on the x axis: -1 west only, 1 east only, 0 both]
const TOWNS: [string, number, number, number, -1 | 0 | 1][] = [
  ["Chișinău", 28.8638, 47.0105, 22, 0],
  ["Bălți", 27.9289, 47.7617, 6, 0],
  ["Cahul", 28.1944, 45.9075, 4, 1],
  ["Ungheni", 27.8006, 47.2108, 4, 1],
  ["Soroca", 28.2975, 48.1558, 3, -1],
  ["Orhei", 28.8231, 47.3831, 4, 0],
  ["Comrat", 28.6553, 46.3017, 3, 0],
  ["Edineț", 27.305, 48.1681, 3, 0],
  ["Hîncești", 28.5911, 46.8306, 4, 0],
  ["Strășeni", 28.6103, 47.1414, 3, 0],
  ["Căușeni", 29.4111, 46.6436, 3, -1],
  ["Drochia", 27.8139, 48.0353, 3, 0],
  ["Florești", 28.3014, 47.8933, 3, 0],
  ["Ialoveni", 28.7781, 46.9431, 3, 0],
  ["Anenii Noi", 29.2311, 46.8783, 3, -1],
  ["Nisporeni", 28.1783, 47.0814, 3, 0],
  ["Rezina", 28.9622, 47.7494, 2, -1],
  ["Sîngerei", 28.1425, 47.6361, 3, 0],
  ["Cimișlia", 28.7836, 46.52, 2, 0],
  ["Leova", 28.2553, 46.4786, 2, 1],
  ["Ocnița", 27.48, 48.4108, 2, 0],
  ["Briceni", 27.085, 48.36, 2, 1],
  ["Fălești", 27.7131, 47.5722, 3, 0],
  ["Glodeni", 27.5144, 47.77, 2, 1],
  ["Rîșcani", 27.5539, 47.9561, 2, 0],
  ["Dondușeni", 27.5853, 48.2242, 2, 0],
  ["Călărași", 28.3081, 47.2544, 3, 0],
  ["Telenești", 28.3656, 47.4997, 2, 0],
  ["Șoldănești", 28.7964, 47.8158, 2, -1],
  ["Criuleni", 29.1594, 47.2131, 2, -1],
  ["Ștefan Vodă", 29.6631, 46.5128, 2, -1],
  ["Basarabeasca", 28.9614, 46.3336, 1, 0],
  ["Taraclia", 28.6689, 45.9, 2, 0],
  ["Ceadîr-Lunga", 28.83, 46.055, 2, 0],
  ["Vulcănești", 28.4042, 45.6842, 1, 0],
  ["Cantemir", 28.2017, 46.2778, 2, 1],
];

const KG_NAMES = ["Licurici", "Albinuța", "Ghiocel", "Andrieș", "Steluța", "Floricica", "Guguță", "Mărțișor", "Fluturaș", "Izvoraș", "Soarele", "Spicușor", "Ciocârlia", "Romanița", "Prichindel", "Cireșica", "Lăstărel", "Clopoțel"];
const SCHOOL_NAMES = ["Mihai Eminescu", "Ion Creangă", "Alexandru cel Bun", "Ștefan cel Mare", "Grigore Vieru", "Lucian Blaga", "Vasile Alecsandri", "Dimitrie Cantemir"];

const ring = (border as { coordinates: number[][][] }).coordinates[0];

function placeNear(town: (typeof TOWNS)[number], spread: number): LngLat {
  const [, lng, lat, , dir] = town;
  for (let i = 0; i < 30; i++) {
    let dx = (rand() - 0.5) * 2 * spread * 1.4;
    const dy = (rand() - 0.5) * 2 * spread;
    if (dir === -1) dx = -Math.abs(dx);
    if (dir === 1) dx = Math.abs(dx);
    const p: LngLat = [lng + dx, lat + dy];
    if (pointInPolygon(p, ring)) return p;
  }
  return [lng, lat];
}

function makeInstitutions(total: number): Institution[] {
  const weightSum = TOWNS.reduce((s, t) => s + t[3], 0);
  const out: Institution[] = [];
  const counters: Record<InstitutionType, number> = { kindergarten: 0, school: 0, hospital: 0, prison: 0, social: 0 };
  const hospitalTowns = new Set<string>();
  // A handful of penitentiaries, placed near the towns that actually have one.
  const prisonTowns = ["Chișinău", "Chișinău", "Soroca", "Hîncești", "Taraclia", "Orhei", "Bălți", "Criuleni"];
  prisonTowns.forEach((name, i) => {
    const town = TOWNS.find((t) => t[0] === name)!;
    out.push({ id: `I${out.length + 1}`, name: `Penitenciarul nr. ${[13, 16, 6, 7, 3, 17, 11, 15][i]}`, type: "prison", town: name, pos: placeNear(town, 0.08), windowEnd: DELIVER_BY });
  });
  while (out.length < total) {
    let r = rand() * weightSum;
    const town = TOWNS.find((t) => (r -= t[3]) < 0) ?? TOWNS[0];
    const isCity = town[0] === "Chișinău" || town[0] === "Bălți";
    const spread = isCity ? 0.05 : between(0.03, 0.16);
    const roll = rand();
    let type: InstitutionType = roll < 0.7 ? "kindergarten" : roll < 0.85 ? "school" : roll < 0.93 ? "social" : "hospital";
    if (type === "hospital" && hospitalTowns.has(town[0]) && !isCity) type = "kindergarten";
    counters[type]++;
    let name: string;
    if (type === "kindergarten") name = rand() < 0.5 ? `Grădinița nr. ${counters.kindergarten + 1}` : `Grădinița «${pick(KG_NAMES)}»`;
    else if (type === "school") name = rand() < 0.5 ? `Gimnaziul nr. ${counters.school + 1}` : `Liceul Teoretic «${pick(SCHOOL_NAMES)}»`;
    else if (type === "hospital") {
      name = hospitalTowns.has(town[0]) ? `Spitalul Clinic nr. ${counters.hospital}` : `Spitalul Raional ${town[0]}`;
      hospitalTowns.add(town[0]);
    } else name = pick([`Centrul de plasament ${town[0]}`, `Azilul de bătrâni ${town[0]}`, `Casa de copii ${town[0]}`]);
    out.push({
      id: `I${out.length + 1}`,
      name,
      type,
      town: town[0],
      pos: placeNear(town, spread),
      windowEnd: DELIVER_BY,
    });
  }
  return out;
}

export const PRODUCTS: Product[] = [
  { id: "p-carrot", name: "Morcov", zone: "cellar", unit: "kg", stock: 5200, min: 2500, color: "#f08a24" },
  { id: "p-potato", name: "Cartofi", zone: "cellar", unit: "kg", stock: 14800, min: 7000, color: "#b98a4f" },
  { id: "p-onion", name: "Ceapă", zone: "cellar", unit: "kg", stock: 2900, min: 1400, color: "#d9b26a" },
  { id: "p-cabbage", name: "Varză", zone: "cellar", unit: "kg", stock: 1400, min: 2400, color: "#8cc56b" },
  { id: "p-beet", name: "Sfeclă", zone: "cellar", unit: "kg", stock: 1900, min: 800, color: "#a3324f" },
  { id: "p-apple", name: "Mere", zone: "cellar", unit: "kg", stock: 4800, min: 2500, color: "#e2483d" },
  { id: "p-pear", name: "Pere", zone: "cellar", unit: "kg", stock: 640, min: 750, color: "#d6cc4a" },
  { id: "p-milk", name: "Lapte 2,5%", zone: "cold", unit: "l", stock: 9600, min: 6000, color: "#e8eef9" },
  { id: "p-sour", name: "Smântână", zone: "cold", unit: "kg", stock: 650, min: 300, color: "#f3f1e4" },
  { id: "p-cheese", name: "Brânză de vaci", zone: "cold", unit: "kg", stock: 1800, min: 900, color: "#f6efd2" },
  { id: "p-butter", name: "Unt 72%", zone: "cold", unit: "kg", stock: 380, min: 450, color: "#f4dc7c" },
  { id: "p-chicken", name: "Carne de pui", zone: "cold", unit: "kg", stock: 3600, min: 1800, color: "#f2b9a4" },
  { id: "p-beef", name: "Carne de vită", zone: "cold", unit: "kg", stock: 2100, min: 1000, color: "#c2504a" },
  { id: "p-fish", name: "Pește (hec)", zone: "cold", unit: "kg", stock: 1400, min: 700, color: "#9fb7cf" },
  { id: "p-flour", name: "Făină", zone: "dry", unit: "kg", stock: 6100, min: 2000, color: "#efe6d2" },
  { id: "p-buck", name: "Hrișcă", zone: "dry", unit: "kg", stock: 2100, min: 1000, color: "#8f6b4a" },
  { id: "p-rice", name: "Orez", zone: "dry", unit: "kg", stock: 2200, min: 900, color: "#f5f3ea" },
  { id: "p-pasta", name: "Paste făinoase", zone: "dry", unit: "kg", stock: 1900, min: 900, color: "#e9cf7d" },
  { id: "p-sugar", name: "Zahăr", zone: "dry", unit: "kg", stock: 2900, min: 1000, color: "#fbfbfb" },
  { id: "p-oil", name: "Ulei de floarea-soarelui", zone: "dry", unit: "l", stock: 1450, min: 700, color: "#f1c94b" },
  { id: "p-salt", name: "Sare iodată", zone: "dry", unit: "kg", stock: 760, min: 150, color: "#dfe5ee" },
  { id: "p-peas", name: "Mazăre conservată", zone: "dry", unit: "pcs", stock: 480, min: 500, color: "#7fb05a" },
];

const DRIVERS = ["Ion Rusu", "Vasile Ceban", "Andrei Lungu", "Sergiu Popa", "Mihai Cojocaru", "Victor Țurcanu", "Igor Munteanu", "Nicolae Ciobanu", "Alexandru Rotaru", "Dumitru Guțu", "Petru Bivol", "Ruslan Moraru", "Oleg Sârbu", "Valeriu Cebotari", "Grigore Țurcan", "Eugen Botnari"];
const MODELS: [string, boolean, number][] = [
  ["Isuzu NQR · frigorific", true, 3500],
  ["Mercedes Atego · frigorific", true, 5000],
  ["Iveco Daily · frigorific", true, 2200],
  ["Ford Transit · izoterm", false, 1400],
  ["Renault Master", false, 1500],
  ["MAN TGL · frigorific", true, 4500],
];
const TRUCK_COLORS = ["#2f6bff", "#13a37f", "#f08a24", "#8d5cf6", "#e2483d", "#0aa5c2", "#d9a400", "#e0559b", "#4f8a10", "#5a6b8c", "#b5651d", "#3b3fb8"];

/**
 * The real fleet as listed in the GPS client (row number = Mașina N).
 * `gps: false` = the tracker has never reported (last time 01.01 00:00:00 in the GPS client).
 */
export const REAL_FLEET: { plate: string; tracker: string; gps: boolean }[] = [
  { plate: "XLX 827", tracker: "059166", gps: true },
  { plate: "XLX 119", tracker: "065129", gps: true },
  { plate: "XLX 092", tracker: "059072", gps: true },
  { plate: "WSS 904", tracker: "059024", gps: false },
  { plate: "WSS 794", tracker: "059085", gps: false },
  { plate: "SZS 070", tracker: "065080", gps: true },
  { plate: "ROV 016", tracker: "059084", gps: true },
  { plate: "MSM 906", tracker: "068235", gps: true },
  { plate: "MSM 860", tracker: "062138", gps: true },
  { plate: "KZC 153", tracker: "009254", gps: true },
  { plate: "KOL 959", tracker: "059083", gps: true },
  { plate: "HNAX 023", tracker: "065133", gps: false },
  { plate: "DAD 1", tracker: "068226", gps: true },
  { plate: "BTM 486", tracker: "068234", gps: true },
  { plate: "BKB 717", tracker: "068232", gps: true },
  { plate: "BKB 702", tracker: "068233", gps: true },
];
export const MAX_TRUCKS = 30;

/** Fleet cards before anyone edits them: real plates/trackers, demo models, drivers and phones. */
export function defaultTruckInfo(number: number): TruckInfo {
  const k = number - 1;
  const r = rng(9100 + number);
  const [model, refrigerated, capacityKg] = MODELS[k % MODELS.length];
  return {
    number,
    plate: REAL_FLEET[k]?.plate ?? "",
    trackerId: REAL_FLEET[k]?.tracker ?? "",
    gpsOk: REAL_FLEET[k]?.gps ?? false,
    model,
    capacityKg,
    refrigerated,
    driver: DRIVERS[k % DRIVERS.length],
    phone: `+373 6${Math.floor(r() * 9)} ${100 + Math.floor(r() * 899)} ${100 + Math.floor(r() * 899)}`,
    routeType: k % 3 === 0 ? "fix" : "zilnic",
    active: true,
  };
}
export const DEFAULT_FLEET: TruckInfo[] = REAL_FLEET.map((_, k) => defaultTruckInfo(k + 1));

export const truckColor = (k: number) => (k < TRUCK_COLORS.length ? TRUCK_COLORS[k] : `hsl(${(k * 137) % 360} 65% 48%)`);

/**
 * Demo order profile: how often a product appears in an order and the usual quantity for a
 * kindergarten-sized delivery (2–3 days of meals). Replaced by real 1C orders later.
 */
const ORDER_PROFILE: Record<string, [freq: number, min: number, max: number]> = {
  "p-carrot": [0.8, 5, 12], "p-potato": [0.9, 12, 30], "p-onion": [0.7, 3, 7], "p-cabbage": [0.6, 6, 15], "p-beet": [0.5, 3, 7], "p-apple": [0.7, 6, 15], "p-pear": [0.35, 3, 9],
  "p-milk": [0.8, 12, 30], "p-sour": [0.4, 1, 4], "p-cheese": [0.5, 2, 6], "p-butter": [0.6, 1, 3], "p-chicken": [0.6, 5, 12], "p-beef": [0.4, 4, 9], "p-fish": [0.3, 3, 7],
  "p-flour": [0.4, 6, 15], "p-buck": [0.5, 3, 7], "p-rice": [0.5, 3, 7], "p-pasta": [0.5, 3, 7], "p-sugar": [0.5, 3, 6], "p-oil": [0.5, 2, 5], "p-salt": [0.2, 1, 2], "p-peas": [0.25, 4, 12],
};

export function makeLines(type: InstitutionType, r: () => number): OrderLine[] {
  // Prisons and hospitals feed far more people than a kindergarten.
  const scale = type === "prison" ? 6 : type === "hospital" ? 3.5 : type === "school" ? 2 : type === "social" ? 1.5 : 1;
  const lines = PRODUCTS.flatMap((p) => {
    const [freq, min, max] = ORDER_PROFILE[p.id] ?? [0.3, 2, 6];
    return r() < freq ? [{ productId: p.id, qty: Math.max(1, Math.round((min + r() * (max - min)) * scale)) }] : [];
  });
  return lines.length >= 3 ? lines : [{ productId: "p-potato", qty: Math.round(15 * scale) }, { productId: "p-milk", qty: Math.round(15 * scale) }, ...lines];
}

export const INSTITUTIONS = makeInstitutions(800);
export const INSTITUTION_BY_ID = new Map(INSTITUTIONS.map((i) => [i.id, i]));
const DEMO_INSTITUTIONS = [...INSTITUTIONS];

/** Where the institutions on screen come from. */
export const DATA_SOURCE = { institutions: "demo" as "demo" | "import" };

/**
 * Swap the institution list (e.g. after an Excel import). The arrays/maps are updated in place so every
 * module keeps the same references; callers then rebuild the fleet so routes use the new points.
 * Pass null to go back to the demo institutions.
 */
export function replaceInstitutions(list: Institution[] | null) {
  const next = list ?? DEMO_INSTITUTIONS;
  INSTITUTIONS.splice(0, INSTITUTIONS.length, ...next);
  INSTITUTION_BY_ID.clear();
  next.forEach((i) => INSTITUTION_BY_ID.set(i.id, i));
  DATA_SOURCE.institutions = list ? "import" : "demo";
}

export const DEFAULT_WAREHOUSE: LngLat = [WAREHOUSE[0], WAREHOUSE[1]];
/** Move the warehouse (updated in place, like the institution list). */
export function setWarehouse(pos: LngLat) {
  WAREHOUSE[0] = pos[0];
  WAREHOUSE[1] = pos[1];
}

/** Town centre by name, ignoring diacritics and case (used to place institutions without coordinates). */
export function findTown(name: string): { name: string; pos: LngLat } | null {
  const key = normalize(name);
  if (!key) return null;
  const t = TOWNS.find((x) => normalize(x[0]) === key) ?? TOWNS.find((x) => key.includes(normalize(x[0])));
  return t ? { name: t[0], pos: [t[1], t[2]] } : null;
}
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export const insideMoldova = (p: LngLat) => pointInPolygon(p, ring);
export const PRODUCT_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

/**
 * Example orders for a day, used only while no real order is registered for it (shown as "Date demo").
 * Deterministic per date: every computer and phone sees the same example day.
 */
export function demoOrders(date: string): Order[] {
  const seed = Number(date.replace(/-/g, ""));
  const r = rng(seed);
  const day = new Date(`${date}T12:00:00`).getTime();
  const out: Order[] = [];
  for (const inst of INSTITUTIONS) {
    if (r() > 0.21) continue;
    const n = out.length + 1;
    out.push({
      id: `D${date.replace(/-/g, "")}-${n}`,
      no: `D-${String(n).padStart(4, "0")}`,
      institutionId: inst.id,
      date,
      lines: makeLines(inst.type, r),
      status: "noua",
      createdAt: day - (1 + Math.floor(r() * 3)) * 86_400_000 - Math.floor(r() * 6) * 3_600_000,
      source: "demo",
    });
  }
  return out;
}
