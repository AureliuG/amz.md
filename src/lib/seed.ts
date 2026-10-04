/**
 * Demo data. Everything here is generated (deterministically) and will be replaced by
 * data imported from 1C: institutions, orders, products/stock, trucks and drivers.
 */
import border from "./moldova-border.json";
import { bearingDeg, haversineKm, pointInPolygon } from "./geo";
import type { Institution, InstitutionType, LngLat, OrderLine, Product, Stop, Truck } from "./types";

/** Warehouse location. Placeholder in Chișinău; replace with the real address. */
export const WAREHOUSE: LngLat = [28.901, 47.0245];
export const DOCK_COUNT = 6;
export const BACK_DOCK_COUNT = 2;

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
    out.push({ id: `I${out.length + 1}`, name: `Penitenciarul nr. ${[13, 16, 6, 7, 3, 17, 11, 15][i]}`, type: "prison", town: name, pos: placeNear(town, 0.08), windowEnd: 14 * 60 });
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
      // Kindergartens need the food before lunch is cooked.
      windowEnd: type === "kindergarten" ? 11 * 60 : type === "school" ? 12 * 60 : 14 * 60,
    });
  }
  return out;
}

export const PRODUCTS: Product[] = [
  { id: "p-carrot", name: "Morcov", zone: "cellar", unit: "kg", stock: 4200, min: 1500, color: "#f08a24" },
  { id: "p-potato", name: "Cartofi", zone: "cellar", unit: "kg", stock: 11800, min: 4000, color: "#b98a4f" },
  { id: "p-onion", name: "Ceapă", zone: "cellar", unit: "kg", stock: 2600, min: 1200, color: "#d9b26a" },
  { id: "p-cabbage", name: "Varză", zone: "cellar", unit: "kg", stock: 1400, min: 1500, color: "#8cc56b" },
  { id: "p-beet", name: "Sfeclă", zone: "cellar", unit: "kg", stock: 1900, min: 800, color: "#a3324f" },
  { id: "p-apple", name: "Mere", zone: "cellar", unit: "kg", stock: 3500, min: 1500, color: "#e2483d" },
  { id: "p-pear", name: "Pere", zone: "cellar", unit: "kg", stock: 640, min: 700, color: "#d6cc4a" },
  { id: "p-milk", name: "Lapte 2,5%", zone: "cold", unit: "l", stock: 2400, min: 1000, color: "#e8eef9" },
  { id: "p-sour", name: "Smântână", zone: "cold", unit: "kg", stock: 380, min: 200, color: "#f3f1e4" },
  { id: "p-cheese", name: "Brânză de vaci", zone: "cold", unit: "kg", stock: 520, min: 300, color: "#f6efd2" },
  { id: "p-butter", name: "Unt 72%", zone: "cold", unit: "kg", stock: 210, min: 250, color: "#f4dc7c" },
  { id: "p-chicken", name: "Carne de pui", zone: "cold", unit: "kg", stock: 1300, min: 600, color: "#f2b9a4" },
  { id: "p-beef", name: "Carne de vită", zone: "cold", unit: "kg", stock: 690, min: 400, color: "#c2504a" },
  { id: "p-fish", name: "Pește (hec)", zone: "cold", unit: "kg", stock: 330, min: 200, color: "#9fb7cf" },
  { id: "p-flour", name: "Făină", zone: "dry", unit: "kg", stock: 6100, min: 2000, color: "#efe6d2" },
  { id: "p-buck", name: "Hrișcă", zone: "dry", unit: "kg", stock: 1700, min: 800, color: "#8f6b4a" },
  { id: "p-rice", name: "Orez", zone: "dry", unit: "kg", stock: 2200, min: 800, color: "#f5f3ea" },
  { id: "p-pasta", name: "Paste făinoase", zone: "dry", unit: "kg", stock: 1850, min: 700, color: "#e9cf7d" },
  { id: "p-sugar", name: "Zahăr", zone: "dry", unit: "kg", stock: 2900, min: 1000, color: "#fbfbfb" },
  { id: "p-oil", name: "Ulei de floarea-soarelui", zone: "dry", unit: "l", stock: 1450, min: 600, color: "#f1c94b" },
  { id: "p-salt", name: "Sare iodată", zone: "dry", unit: "kg", stock: 760, min: 300, color: "#dfe5ee" },
  { id: "p-peas", name: "Mazăre conservată", zone: "dry", unit: "pcs", stock: 480, min: 500, color: "#7fb05a" },
];

const DRIVERS = ["Ion Rusu", "Vasile Ceban", "Andrei Lungu", "Sergiu Popa", "Mihai Cojocaru", "Victor Țurcanu", "Igor Munteanu", "Nicolae Ciobanu", "Alexandru Rotaru", "Dumitru Guțu", "Petru Bivol", "Ruslan Moraru"];
const MODELS: [string, boolean, number][] = [
  ["Isuzu NQR · frigorific", true, 3500],
  ["Mercedes Atego · frigorific", true, 5000],
  ["Iveco Daily · frigorific", true, 2200],
  ["Ford Transit · izoterm", false, 1400],
  ["Renault Master", false, 1500],
  ["MAN TGL · frigorific", true, 4500],
];
const TRUCK_COLORS = ["#2f6bff", "#13a37f", "#f08a24", "#8d5cf6", "#e2483d", "#0aa5c2", "#d9a400", "#e0559b", "#4f8a10", "#5a6b8c", "#b5651d", "#3b3fb8"];
const PLATE_LETTERS = ["KDT", "CMB", "BUX", "AGD", "TNL", "RRV", "CKN", "FLA", "OXM", "HPT", "SVR", "LIM"];

const DWELL_MIN = 14;

function buildRoutes(insts: Institution[]): Truck[] {
  const withGeo = insts.map((i) => ({ i, d: haversineKm(WAREHOUSE, i.pos), b: bearingDeg(WAREHOUSE, i.pos) }));
  // Trucks 1–3 serve Chișinău (split by direction); trucks 4–12 split the rest of the country.
  const city = withGeo.filter((x) => x.d < 14).sort((a, b) => a.b - b.b);
  const country = withGeo.filter((x) => x.d >= 14).sort((a, b) => a.b - b.b);
  const chunk = <T,>(arr: T[], n: number) => Array.from({ length: n }, (_, k) => arr.slice(Math.floor((k * arr.length) / n), Math.floor(((k + 1) * arr.length) / n)));
  const sectors = [...chunk(city, 3), ...chunk(country, 9)];

  let orderSeq = 41870;
  return sectors.map((sector, k) => {
    const isCity = k < 3;
    const want = isCity ? 15 : sector[0] && sector[0].d > 90 ? 9 : 11;
    // Today's stops: a compact cluster around a random institution of the sector.
    const anchor = sector[Math.floor(rand() * sector.length)];
    const today = [...sector].sort((a, b) => haversineKm(a.i.pos, anchor.i.pos) - haversineKm(b.i.pos, anchor.i.pos)).slice(0, want).map((x) => x.i);
    // Nearest-neighbour ordering from the warehouse (VROOM will replace this).
    const ordered: Institution[] = [];
    let cur: LngLat = WAREHOUSE;
    const left = [...today];
    while (left.length) {
      left.sort((a, b) => haversineKm(cur, a.pos) - haversineKm(cur, b.pos));
      const next = left.shift()!;
      ordered.push(next);
      cur = next.pos;
    }
    const [model, refrigerated, capacityKg] = MODELS[k % MODELS.length];
    const speed = isCity ? 28 : 52;
    const departAt = 6 * 60 + 25 + k * 8;
    let t = departAt;
    let from: LngLat = WAREHOUSE;
    let total = 0;
    const stops: Stop[] = ordered.map((inst, s) => {
      const km = haversineKm(from, inst.pos) * 1.3;
      total += km;
      t += (km / speed) * 60;
      const lines = makeLines(inst.type);
      const weightKg = lines.reduce((sum, l) => sum + l.qty, 0);
      const arriveAt = t;
      t += DWELL_MIN + weightKg / 60;
      from = inst.pos;
      return { id: `S${k + 1}-${s + 1}`, orderNo: `CMD-${orderSeq++}`, institutionId: inst.id, lines, weightKg: Math.round(weightKg), orderedDaysAgo: 1 + Math.floor(rand() * 3), arriveAt, leaveAt: t, distanceKm: km };
    });
    const backKm = haversineKm(from, WAREHOUSE) * 1.3;
    total += backKm;
    const returnAt = t + (backKm / speed) * 60;
    const regionTowns = [...new Set(ordered.map((o) => o.town))];
    return {
      id: `T${k + 1}`,
      plate: `${PLATE_LETTERS[k]} ${100 + Math.floor(rand() * 899)}`,
      model,
      refrigerated,
      capacityKg,
      driver: DRIVERS[k],
      phone: `+373 6${Math.floor(rand() * 9)} ${100 + Math.floor(rand() * 899)} ${100 + Math.floor(rand() * 899)}`,
      color: TRUCK_COLORS[k],
      dock: (k % DOCK_COUNT) + 1,
      region: isCity ? `Chișinău · ${["north", "east", "west"][k]}` : regionTowns.slice(0, 2).join(", "),
      loadStart: departAt - 45,
      departAt,
      returnAt,
      totalKm: Math.round(total),
      stops,
    };
  });
}

function makeLines(type: InstitutionType): OrderLine[] {
  const scale = type === "prison" ? 6 : type === "hospital" ? 3.5 : type === "school" ? 2 : type === "social" ? 1.5 : 1;
  const n = 5 + Math.floor(rand() * 5);
  const chosen = [...PRODUCTS].sort(() => rand() - 0.5).slice(0, n);
  return chosen.map((p) => ({ productId: p.id, qty: Math.round(between(4, 30) * scale) }));
}

export const INSTITUTIONS = makeInstitutions(800);
export const INSTITUTION_BY_ID = new Map(INSTITUTIONS.map((i) => [i.id, i]));
export const TRUCKS = buildRoutes(INSTITUTIONS);
export const PRODUCT_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

/** Orders already received from 1C for the next days (demo numbers). */
export const PIPELINE = [
  { label: "Tomorrow", orders: 152, kg: 18400 },
  { label: "In 2 days", orders: 138, kg: 16900 },
  { label: "In 3 days", orders: 61, kg: 7300 },
];
