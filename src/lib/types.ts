export type LngLat = [number, number];

export type InstitutionType = "kindergarten" | "school" | "hospital" | "prison" | "social";

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  town: string;
  pos: LngLat;
  /** Latest time (minutes from midnight) the delivery should arrive. */
  windowEnd: number;
  /** How the position was obtained: exact coordinates, approximated from the town, or geocoded from the address. */
  precision?: "exact" | "town" | "geocoded";
  address?: string;
  phone?: string;
  /** Code in 1C, when imported. */
  code?: string;
}

export type StorageZone = "cellar" | "cold" | "dry";

export interface Product {
  id: string;
  name: string;
  zone: StorageZone;
  unit: "kg" | "l" | "pcs";
  stock: number;
  min: number;
  color: string;
}

export interface OrderLine {
  productId: string;
  qty: number;
}

export interface Stop {
  id: string;
  /** The order this stop delivers (Order.id) and its number shown to people and drivers. */
  orderId: string;
  orderNo: string;
  institutionId: string;
  lines: OrderLine[];
  weightKg: number;
  orderedDaysAgo: number;
  /** Planned arrival / departure at the stop, minutes from midnight. */
  arriveAt: number;
  leaveAt: number;
  distanceKm: number;
}

/** Editable fleet card for one vehicle (saved on the server, edited on the Date page). */
export interface TruckInfo {
  number: number;
  plate: string;
  trackerId: string;
  /** False when the tracker is known not to report (e.g. never connected in the GPS client). */
  gpsOk: boolean;
  model: string;
  capacityKg: number;
  refrigerated: boolean;
  driver: string;
  phone: string;
  /** Fixed route (same institutions on set weekdays) or planned fresh every day. */
  routeType: "fix" | "zilnic";
  /** Inactive vehicles (service, no driver) are kept on file but not planned. */
  active: boolean;
  /** Fixed route: localities this vehicle always serves, comma-separated (e.g. "Orhei, Rezina"). */
  towns?: string;
  notes?: string;
}

/** An order from an institution: taken by phone and registered on the Comenzi page (later also from 1C). */
export interface Order {
  id: string;
  /** Number shown everywhere, on the sheets and on the driver's phone (e.g. "CMD-00042"). */
  no: string;
  institutionId: string;
  /** Delivery day, YYYY-MM-DD. */
  date: string;
  lines: OrderLine[];
  note?: string;
  status: "noua" | "anulata";
  /** When it was registered (epoch ms). */
  createdAt: number;
  /** telefon = typed in by the office; test = generated to try the app; demo = example, never saved; 1c = imported. */
  source: "telefon" | "test" | "demo" | "1c";
  /** Invoice (factură) number from 1C, when known. */
  invoiceNo?: string;
}

/** The saved routes of one day: which orders each vehicle carries, in delivery order. */
export interface DayPlan {
  date: string;
  routes: { truck: number; orderIds: string[] }[];
  /** Approved by the dispatcher: new orders for that day then wait in "neplanificate" instead of reshuffling routes. */
  approved: boolean;
  /** Vehicles whose loading the warehouse confirmed (truck number → epoch ms). Stock is taken out at that moment. */
  loaded: Record<string, number>;
  updatedAt: number;
}

/** A change of stock: goods received, loaded onto a truck, or corrected after counting. */
export interface StockMove {
  id: string;
  ts: number;
  type: "intrare" | "iesire" | "corectie";
  lines: OrderLine[];
  note?: string;
  /** Unique reference (e.g. "incarcare:2026-10-14:3") so the same loading is never taken out twice. */
  ref?: string;
}

/** What a driver reported for a delivery (from the Șofer page). Keyed by order number. */
export interface Confirmation {
  orderNo: string;
  truck: number;
  status: "arrived" | "delivered" | "problem";
  reason?: string;
  ts: number;
}

export interface Truck {
  id: string;
  /** Fleet number shown everywhere ("Mașina 3"). */
  number: number;
  label: string;
  /** Registration plate; empty until the real fleet data is entered. */
  plate: string;
  /** GPS tracker ID from the GPS client; empty for trucks not yet registered there. */
  trackerId: string;
  /** False when the tracker has never reported a position. */
  gpsOk: boolean;
  model: string;
  refrigerated: boolean;
  capacityKg: number;
  driver: string;
  phone: string;
  routeType: "fix" | "zilnic";
  color: string;
  region: string;
  /** Loading: first at the beci (vegetables and fruit, if any), then at the single ramp of the depot. */
  loadStart: number;
  beci: { from: number; to: number } | null;
  ramp: { from: number; to: number };
  /** Position in the day's loading queue (1 = first). */
  loadOrder: number;
  departAt: number;
  returnAt: number;
  totalKm: number;
  stops: Stop[];
}

export type TruckStatus = "parked" | "loading" | "departing" | "driving" | "unloading" | "returning" | "arriving" | "done";

export interface TruckState {
  status: TruckStatus;
  pos: LngLat;
  bearing: number;
  /** Index of the stop being driven to / unloaded at; stops.length while returning. */
  stopIdx: number;
  delivered: number;
  /** 0..1 progress of the current activity (loading, unloading, leg). */
  progress: number;
  /** Minutes until the current activity ends. */
  minutesLeft: number;
  /** 0..1 position along the yard path while departing/arriving. */
  yard: number;
}

export type StopStatus = "planned" | "next" | "unloading" | "delivered";

export type Selection =
  | { kind: "truck"; id: string }
  | { kind: "institution"; id: string }
  | { kind: "dock"; id: "rampa" | "beci" }
  | { kind: "zone"; id: StorageZone | "office" }
  | { kind: "warehouse" }
  | null;

/** A suggestion, problem or question sent from the Ghid page or the Șofer page. */
export interface Feedback {
  id: string;
  ts: number;
  name: string;
  kind: "problema" | "propunere" | "intrebare";
  page: string;
  text: string;
  priority: "mica" | "medie" | "mare";
  status: "nou" | "in-lucru" | "planificat" | "rezolvat" | "respins";
  /** Answer or note from whoever handles it (e.g. "în versiunea 1.3"). */
  reply?: string;
  /** App version the user had when sending it. */
  version: string;
  from: "birou" | "sofer";
}
