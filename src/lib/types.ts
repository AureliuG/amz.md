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
