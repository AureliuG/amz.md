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
  notes?: string;
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
  /** Orders of this truck's area that did not fit within its capacity today. */
  leftover: { count: number; kg: number };
  color: string;
  dock: number;
  region: string;
  loadStart: number;
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
  | { kind: "dock"; id: number }
  | { kind: "zone"; id: StorageZone | "office" }
  | { kind: "warehouse" }
  | null;
