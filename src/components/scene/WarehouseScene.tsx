"use client";

import { Html, MapControls, OrthographicCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Color, Vector3, type DirectionalLight, type Group } from "three";
import { PRODUCTS } from "@/lib/seed";
import { loadingPlace, PLACE_LABEL, STATUS_LABEL, truckState } from "@/lib/sim";
import { useUi } from "@/lib/store";
import type { Truck } from "@/lib/types";
import { Box, BrandSign, ForkliftModel, Pallet, Tree, TruckModel } from "./models";

/* ---------------- layout (metres, +z faces the camera / front gate) ---------------- */
const B = { x0: -32, x1: 32, z0: -26, z1: 4, h: 9 };
/** The single loading ramp of the depot (front wall) and the beci next to the depot, on the left. */
const RAMP_X = -14;
const RAMP_TRUCK_Z = B.z1 + 5.8;
const BECI = { x0: -60, x1: -40, z0: -22, z1: -2, depth: 4.5 };
const BECI_DOOR_X = (BECI.x0 + BECI.x1) / 2;
const BECI_TRUCK_Z = BECI.z1 + 5.6;
/** Where a truck waits when it is done at the beci and the ramp is still busy. */
const WAIT: [number, number] = [-30, 23];
const BACK_DOCK_COUNT = 2;
/** Parking: two rows of six to the right of the building; trucks 13+ continue further right. */
const slotCol = (i: number) => (i % 6) + 6 * Math.floor(i / 12);
const slot = (i: number): [number, number] => [42 + slotCol(i) * 6.5, Math.floor(i / 6) % 2 === 0 ? -14 : 6];
const fenceRight = (count: number) => Math.max(82, 42 + slotCol(count - 1) * 6.5 + 10);
const GATE_X = 4;
const FENCE_Z = 44;
const ROAD_Z = 54;

const C = {
  ground: "#f4f6fc",
  yard: "#e6ebf6",
  wall: "#f8f9fd",
  roof: "#2f6bff",
  roofEdge: "#2353d6",
  door: "#c7d1e8",
  line: "#f2c94c",
};

type P = [number, number];
/** Position and heading at fraction `u` of a polyline. With `reverseLast`, the last segment is driven backwards (backing into a dock). */
function along(path: P[], u: number, reverseLast = false): { p: P; heading: number } {
  const seg = path.slice(1).map((b, i) => Math.hypot(b[0] - path[i][0], b[1] - path[i][1]));
  let d = Math.min(1, Math.max(0, u)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const a = path[i];
      const b = path[i + 1];
      const f = seg[i] ? Math.min(1, d / seg[i]) : 0;
      const back = reverseLast && i === seg.length - 1;
      return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], heading: back ? Math.atan2(a[0] - b[0], a[1] - b[1]) : Math.atan2(b[0] - a[0], b[1] - a[1]) };
    }
    d -= seg[i];
  }
  return { p: path[0], heading: 0 };
}
/** Minutes spent driving from one place to the next and backing in (parking → beci, waiting spot → ramp). */
const MANEUVER_MIN = 3;
/** Minutes from the beci to the waiting spot (the planner allows 4 minutes between beci and ramp). */
const BECI_OUT_MIN = 3;
const slotToBeci = (i: number): P[] => {
  const [sx, sz] = slot(i);
  return [[sx, sz], [sx, 26], [BECI_DOOR_X, 22], [BECI_DOOR_X, BECI_TRUCK_Z]];
};
const beciToWait: P[] = [[BECI_DOOR_X, BECI_TRUCK_Z], [BECI_DOOR_X, 17], WAIT];
const waitToRamp: P[] = [WAIT, [RAMP_X, 23], [RAMP_X, RAMP_TRUCK_Z]];
const slotToRamp = (i: number): P[] => {
  const [sx, sz] = slot(i);
  return [[sx, sz], [sx, 26], [RAMP_X, 24], [RAMP_X, RAMP_TRUCK_Z]];
};
const departPath: P[] = [[RAMP_X, RAMP_TRUCK_Z], [RAMP_X, 28], [GATE_X, 34], [GATE_X, FENCE_Z], [GATE_X + 8, ROAD_Z + 2], [140, ROAD_Z + 2]];
const arrivePath = (i: number): P[] => {
  const [sx, sz] = slot(i);
  return [[140, ROAD_Z - 2], [GATE_X + 10, ROAD_Z - 2], [GATE_X + 2, FENCE_Z], [GATE_X + 2, 32], [sx, 30], [sx, sz]];
};

/** Yard position of a truck that is loading: driving to the beci, at the beci, waiting, driving to the ramp, at the ramp. */
function loadingPose(tr: Truck, i: number, t: number): { p: P; heading: number } {
  if (tr.beci && t < tr.beci.to) {
    const m = (t - tr.beci.from) / MANEUVER_MIN;
    return m < 1 ? along(slotToBeci(i), m, true) : { p: [BECI_DOOR_X, BECI_TRUCK_Z], heading: 0 };
  }
  if (t < tr.ramp.from) {
    const m = tr.beci ? (t - tr.beci.to) / BECI_OUT_MIN : 1;
    return m < 1 ? along(beciToWait, m) : { p: WAIT, heading: Math.PI / 2 };
  }
  const m = (t - tr.ramp.from) / MANEUVER_MIN;
  if (m < 1) return along(tr.beci ? waitToRamp : slotToRamp(i), m, true);
  return { p: [RAMP_X, RAMP_TRUCK_Z], heading: 0 };
}

/* ---------------- scene pieces ---------------- */

function Ground() {
  const g = 170;
  const pieces: [number, number, number, number][] = [
    [-g, BECI.x0, -g, g],
    [BECI.x1, g, -g, g],
    [BECI.x0, BECI.x1, -g, BECI.z0],
    [BECI.x0, BECI.x1, BECI.z1, g],
  ];
  return (
    <group>
      {pieces.map(([x0, x1, z0, z1], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} receiveShadow>
          <planeGeometry args={[x1 - x0, z1 - z0]} />
          <meshStandardMaterial color={C.ground} />
        </mesh>
      ))}
      {/* yard asphalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1, 0.02, 19]} receiveShadow>
        <planeGeometry args={[124, 50]} />
        <meshStandardMaterial color={C.yard} />
      </mesh>
      {/* roads */}
      {[ROAD_Z, -48].map((z) => (
        <group key={z}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, z]} receiveShadow>
            <planeGeometry args={[340, 11]} />
            <meshStandardMaterial color="#d3dbea" />
          </mesh>
          {Array.from({ length: 34 }, (_, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-165 + i * 10, 0.05, z]}>
              <planeGeometry args={[4, 0.35]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Fence() {
  const right = fenceRight(useUi((s) => s.trucks.length));
  const segs: [number, number, number, number][] = [
    [-70, GATE_X - 4, FENCE_Z, FENCE_Z],
    [GATE_X + 8, right, FENCE_Z, FENCE_Z],
    [-70, -6, -40, -40],
    [6, right, -40, -40],
    [-70, -70, -40, FENCE_Z],
    [right, right, -40, FENCE_Z],
  ];
  return (
    <group>
      {segs.map(([x0, x1, z0, z1], i) => (
        <Box key={i} size={[Math.max(0.2, x1 - x0), 1.6, Math.max(0.2, z1 - z0)]} pos={[(x0 + x1) / 2, 0.8, (z0 + z1) / 2]} color="#c3ccdf" opacity={0.75} />
      ))}
      {/* gate posts */}
      {[GATE_X - 4, GATE_X + 8].map((x) => (
        <Box key={x} size={[0.8, 2.6, 0.8]} pos={[x, 1.3, FENCE_Z]} color="#2f6bff" />
      ))}
      {[-6, 6].map((x) => (
        <Box key={x} size={[0.8, 2.6, 0.8]} pos={[x, 1.3, -40]} color="#9aa6c0" />
      ))}
      <Label pos={[GATE_X + 2, 4.5, FENCE_Z]} text="Intrarea principală" tone="blue" />
      <Label pos={[0, 4, -40]} text="Intrarea din spate · folosită rar" tone="gray" />
    </group>
  );
}

function Building() {
  const roofOff = useUi((s) => s.roofOff);
  const select = useUi((s) => s.select);
  const { x0, x1, z0, z1, h } = B;
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  return (
    <group>
      {/* floor */}
      <Box size={[w, 0.2, d]} pos={[cx, 0.1, cz]} color="#e9edf6" cast={false} />
      {/* walls */}
      <Box size={[w, h, 0.4]} pos={[cx, h / 2, z1]} color={C.wall} />
      <Box size={[w, h, 0.4]} pos={[cx, h / 2, z0]} color={C.wall} />
      <Box size={[0.4, h, d]} pos={[x0, h / 2, cz]} color={C.wall} />
      <Box size={[0.4, h, d]} pos={[x1, h / 2, cz]} color={C.wall} />
      {/* blue band + roof */}
      <Box size={[w + 0.6, 1, 0.6]} pos={[cx, h - 0.2, z1]} color={C.roofEdge} cast={false} />
      <Box size={[w + 0.6, 1, 0.6]} pos={[cx, h - 0.2, z0]} color={C.roofEdge} cast={false} />
      <Box size={[0.6, 1, d + 0.6]} pos={[x0, h - 0.2, cz]} color={C.roofEdge} cast={false} />
      <Box size={[0.6, 1, d + 0.6]} pos={[x1, h - 0.2, cz]} color={C.roofEdge} cast={false} />
      {!roofOff && <Box size={[w + 0.2, 0.6, d + 0.2]} pos={[cx, h + 0.5, cz]} color={C.roof} />}
      {!roofOff &&
        Array.from({ length: 6 }, (_, i) => <Box key={i} size={[3, 0.5, 2]} pos={[x0 + 8 + i * 9, h + 1, cz - 4]} color="#dfe6f5" />)}
      <BrandSign pos={[-4, 7.3, z1 + 0.23]} width={22} />
      {/* the single loading ramp */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: "dock", id: "rampa" });
        }}
      >
        <Box size={[5.2, 4.8, 0.3]} pos={[RAMP_X, 2.6, z1 + 0.25]} color={C.door} />
        {Array.from({ length: 5 }, (_, k) => (
          <Box key={k} size={[5.2, 0.06, 0.32]} pos={[RAMP_X, 0.8 + k * 0.9, z1 + 0.27]} color="#aeb9d4" cast={false} />
        ))}
        {/* raised loading platform with bumpers */}
        <Box size={[6.4, 1.1, 1]} pos={[RAMP_X, 0.55, z1 + 0.6]} color="#c9d2e6" />
        {[-2.2, 2.2].map((o) => (
          <Box key={o} size={[0.4, 0.6, 0.25]} pos={[RAMP_X + o, 0.8, z1 + 1.2]} color="#1f2937" cast={false} />
        ))}
        {[-2.6, 2.6].map((o) => (
          <mesh key={`l${o}`} rotation={[-Math.PI / 2, 0, 0]} position={[RAMP_X + o, 0.06, z1 + 7]}>
            <planeGeometry args={[0.25, 11]} />
            <meshStandardMaterial color={C.line} />
          </mesh>
        ))}
        <Label pos={[RAMP_X, 6.2, z1 + 0.6]} text="Rampa" tone="blue" />
      </group>
      {/* back docks (rarely used) */}
      {Array.from({ length: BACK_DOCK_COUNT }, (_, i) => (
        <Box key={i} size={[4.6, 4.6, 0.3]} pos={[-10 + i * 20, 2.5, z0 - 0.25]} color="#d9dee9" />
      ))}
      {/* office: inside, front-right corner, with windows on the front wall */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: "zone", id: "office" });
        }}
      >
        <Box size={[10, 3.4, 8]} pos={[26, 1.9, -0.2]} color="#ffffff" />
        <Box size={[10.2, 0.3, 8.2]} pos={[26, 3.7, -0.2]} color="#9fb4e6" />
        {[22.5, 26, 29.5].map((x) => (
          <Box key={x} size={[2.2, 1.6, 0.1]} pos={[x, 4.5, z1 + 0.25]} color="#9cc0ff" cast={false} />
        ))}
        <Box size={[1.6, 2.6, 0.12]} pos={[30.2, 1.3, z1 + 0.26]} color="#2f6bff" cast={false} />
      </group>
      <Interior />
    </group>
  );
}

function Interior() {
  const select = useUi((s) => s.select);
  const dry = PRODUCTS.filter((p) => p.zone === "dry");
  const cold = PRODUCTS.filter((p) => p.zone === "cold");
  return (
    <group>
      {/* dry goods racks */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: "zone", id: "dry" });
        }}
      >
        {Array.from({ length: 4 }, (_, r) => (
          <group key={r} position={[-20, 0, -22 + r * 5]}>
            {[0, 1, 2].map((lvl) => (
              <Box key={lvl} size={[22, 0.15, 1.6]} pos={[0, 0.3 + lvl * 2.2, 0]} color="#3f5fb8" cast={false} />
            ))}
            {[-11, -5.5, 0, 5.5, 11].map((x) => (
              <Box key={x} size={[0.15, 6.6, 1.6]} pos={[x, 3.3, 0]} color="#f28b2b" cast={false} />
            ))}
            {Array.from({ length: 12 }, (_, k) => (
              <Pallet key={k} pos={[-9.6 + (k % 6) * 3.8, 0.38 + Math.floor(k / 6) * 2.2, 0]} color={dry[(k + r) % dry.length].color} h={1.2} />
            ))}
          </group>
        ))}
      </group>
      {/* cold room */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: "zone", id: "cold" });
        }}
      >
        <Box size={[18, 4.5, 0.25]} pos={[11, 2.25, -9]} color="#bfe0ff" opacity={0.55} />
        <Box size={[0.25, 4.5, 16]} pos={[2, 2.25, -17]} color="#bfe0ff" opacity={0.55} />
        <Box size={[17.8, 0.05, 15.8]} pos={[11, 0.22, -17]} color="#d6ebff" cast={false} />
        {Array.from({ length: 15 }, (_, k) => (
          <Pallet key={k} pos={[5 + (k % 5) * 3, 0.25, -23 + Math.floor(k / 5) * 4.5]} color={cold[k % cold.length].color} h={1.3} />
        ))}
      </group>
    </group>
  );
}

/** The beci: a half-buried cellar next to the depot for vegetables and fruit, with its own loading door. */
function Beci() {
  const select = useUi((s) => s.select);
  const roofOff = useUi((s) => s.roofOff);
  const { x0, x1, z0, z1, depth } = BECI;
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const items = PRODUCTS.filter((p) => p.zone === "cellar");
  return (
    <group>
      {/* underground room (visible with the roof off) */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: "zone", id: "cellar" });
        }}
      >
        <Box size={[w, 0.2, d]} pos={[cx, -depth, cz]} color="#cfd6e6" cast={false} />
        <Box size={[w, depth, 0.4]} pos={[cx, -depth / 2, z0]} color="#b9c3d8" />
        <Box size={[w, depth, 0.4]} pos={[cx, -depth / 2, z1]} color="#dfe5f1" />
        <Box size={[0.4, depth, d]} pos={[x0, -depth / 2, cz]} color="#c9d1e3" />
        <Box size={[0.4, depth, d]} pos={[x1, -depth / 2, cz]} color="#dfe5f1" />
        {items.map((p, r) =>
          Array.from({ length: 4 }, (_, k) => (
            <group key={`${p.id}${k}`} position={[x0 + 3 + k * 4.5, -depth + 0.1, z0 + 2.2 + (r % 6) * 2.8]}>
              <Box size={[2.6, 1.2, 2]} pos={[0, 0.6, 0]} color="#c49a62" />
              <Box size={[2.3, 0.35, 1.7]} pos={[0, 1.3, 0]} color={p.color} cast={false} />
            </group>
          )),
        )}
      </group>
      {/* above ground: earth-covered vault and a stone front with the loading door */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: "dock", id: "beci" });
        }}
      >
        {!roofOff && (
          <>
            <Box size={[w + 1, 1.6, d + 1]} pos={[cx, 0.8, cz]} color="#9fb98a" />
            <Box size={[w - 4, 1.2, d - 5]} pos={[cx, 2.2, cz - 1]} color="#acc597" />
            <Box size={[w - 10, 0.8, d - 10]} pos={[cx, 3.2, cz - 1.5]} color="#b7cfa2" />
            {/* air vents */}
            {[-5, 5].map((o) => (
              <Box key={o} size={[0.8, 1.6, 0.8]} pos={[cx + o, 4, cz - 2]} color="#e2e8f0" />
            ))}
          </>
        )}
        <Box size={[12, 4.2, 0.8]} pos={[BECI_DOOR_X, 2.1, z1 + 0.4]} color="#e7dcc8" />
        <Box size={[12.6, 0.5, 1.2]} pos={[BECI_DOOR_X, 4.4, z1 + 0.4]} color="#c8b79a" cast={false} />
        <Box size={[4.6, 3.6, 0.2]} pos={[BECI_DOOR_X, 1.8, z1 + 0.85]} color="#6b5440" cast={false} />
        <Box size={[4.8, 0.06, 2.4]} pos={[BECI_DOOR_X, 0.05, z1 + 2]} color="#c7cfdf" cast={false} />
        {[-2.6, 2.6].map((o) => (
          <mesh key={o} rotation={[-Math.PI / 2, 0, 0]} position={[BECI_DOOR_X + o, 0.06, z1 + 7]}>
            <planeGeometry args={[0.25, 11]} />
            <meshStandardMaterial color={C.line} />
          </mesh>
        ))}
      </group>
      <Label pos={[BECI_DOOR_X, 6.2, z1 + 0.6]} text="Beci · legume și fructe" tone="green" />
    </group>
  );
}

function Label({ pos, text, tone = "blue" }: { pos: [number, number, number]; text: string; tone?: "blue" | "gray" | "green" | "amber" }) {
  const cls = { blue: "bg-[#2f6bff] text-white", gray: "bg-white/90 text-slate-500", green: "bg-emerald-500 text-white", amber: "bg-amber-400 text-amber-950" }[tone];
  return (
    <Html position={pos} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm ${cls}`}>{text}</div>
    </Html>
  );
}

function YardTruck({ truck, index }: { truck: Truck; index: number }) {
  const ref = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [shown, setShown] = useState(true);
  const select = useUi((s) => s.select);
  const selected = useUi((s) => s.selection?.kind === "truck" && s.selection.id === truck.id);
  const lastLabel = useRef<string | null>(null);

  const ring = useRef<Group>(null);
  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = useUi.getState().t;
    const st = truckState(truck, t);
    let visible = true;
    let x = 0;
    let z = 0;
    let heading = 0;
    if (st.status === "parked" || st.status === "done") {
      [x, z] = slot(index);
      heading = 0;
    } else if (st.status === "loading") {
      const a = loadingPose(truck, index, t);
      [x, z] = a.p;
      heading = a.heading;
    } else if (st.status === "departing" || st.status === "arriving") {
      const a = st.status === "departing" ? along(departPath, st.yard) : along(arrivePath(index), st.yard, true);
      [x, z] = a.p;
      heading = a.heading;
    } else visible = false;
    g.visible = visible;
    if (visible !== g.userData.shown) {
      g.userData.shown = visible;
      setShown(visible);
    }
    g.position.set(x, 0, z);
    // Ease the heading so turns look like steering rather than snapping.
    const diff = Math.atan2(Math.sin(heading - g.rotation.y), Math.cos(heading - g.rotation.y));
    g.rotation.y = visible && g.userData.placed ? g.rotation.y + diff * Math.min(1, dt * 10) : heading;
    g.userData.placed = visible;
    g.userData.worldX = x;
    g.userData.worldZ = z;
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.06);
    const place = st.status === "loading" ? loadingPlace(truck, t) : null;
    const next = visible && place ? `${truck.label} · ${PLACE_LABEL[place].toLowerCase()}` : null;
    if (next !== lastLabel.current) {
      lastLabel.current = next;
      setLabel(next);
    }
  });

  return (
    <group ref={ref} name={`truck-${truck.id}`}>
      <TruckModel color={truck.color} refrigerated={truck.refrigerated} onClick={() => select({ kind: "truck", id: truck.id })} onHover={setHover} />
      {(selected || hover) && (
        <group ref={ring}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
            <ringGeometry args={[6, 6.6, 48]} />
            <meshBasicMaterial color="#2f6bff" transparent opacity={selected ? 0.9 : 0.5} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
            <circleGeometry args={[6, 48]} />
            <meshBasicMaterial color="#2f6bff" transparent opacity={0.08} />
          </mesh>
        </group>
      )}
      {shown && !label && !selected && !hover && (
        <Html position={[0, 5.8, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
          <div className="grid h-5 w-5 place-items-center rounded-md text-[11px] font-bold text-white shadow ring-2 ring-white" style={{ background: truck.color }}>
            {truck.number}
          </div>
        </Html>
      )}
      {shown && (label || selected || hover) && (
        <Html position={[0, 6.5, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold shadow ${selected ? "bg-[#2f6bff] text-white" : "bg-white text-slate-700"}`}>{label ?? `${truck.label} · ${STATUS_LABEL[truckState(truck, useUi.getState().t).status]}`}</div>
        </Html>
      )}
    </group>
  );
}

/** Staged goods and a forklift shuttling them into the truck at the ramp or at the beci. */
function LoadingActivity({ place }: { place: "rampa" | "beci" }) {
  const fork = useRef<Group>(null);
  const pallets = useRef<Group>(null);
  const x0 = place === "rampa" ? RAMP_X : BECI_DOOR_X;
  const zDoor = place === "rampa" ? B.z1 : BECI.z1;
  useFrame(({ clock }) => {
    const { t, trucks } = useUi.getState();
    const loading = trucks.find((tr) => loadingPlace(tr, t) === place);
    const win = loading && (place === "beci" ? loading.beci! : loading.ramp);
    const progress = win ? (t - win.from) / (win.to - win.from) : 0;
    if (pallets.current) pallets.current.children.forEach((c, i) => (c.visible = !!loading && i >= Math.floor(progress * 6)));
    if (fork.current) {
      fork.current.visible = !!loading;
      const ph = (clock.elapsedTime * 0.35 + (place === "beci" ? 0.4 : 0)) % 1;
      const s = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      fork.current.position.set(x0 + 1.2, place === "beci" ? 0.1 : 0.2, zDoor - 6 + s * 6);
      fork.current.rotation.y = ph < 0.5 ? 0 : Math.PI;
    }
  });
  return (
    <group>
      <group ref={pallets}>
        {Array.from({ length: 6 }, (_, i) => (
          <Pallet key={i} pos={[x0 - 2 + (i % 2) * 1.5, place === "beci" ? 0.1 : 0.2, zDoor - 2 - Math.floor(i / 2) * 1.6]} color={place === "beci" ? "#c49a62" : "#d8b37a"} h={0.9} />
        ))}
      </group>
      <ForkliftModel ref={fork} carrying />
    </group>
  );
}

const SKY = { dawn: new Color("#f1eefb"), noon: new Color("#eef2fb"), dusk: new Color("#f7efe6") };
const SUN = { dawn: new Color("#ffe2c0"), noon: new Color("#ffffff"), dusk: new Color("#ffcfa0") };

/** Sun follows the simulated clock: low and warm in the morning, high at noon, warm again before 18:00. */
function DayLight() {
  const light = useRef<DirectionalLight>(null);
  const { scene } = useThree();
  const sky = useMemo(() => new Color(), []);
  useFrame(() => {
    const t = useUi.getState().t;
    const u = Math.min(1, Math.max(0, (t - 5.5 * 60) / (13 * 60))); // 05:30 → 18:30
    const ang = u * Math.PI; // east → west
    const elev = Math.sin(ang);
    const warm = 1 - elev;
    const from = u < 0.5 ? SUN.dawn : SUN.dusk;
    const skyFrom = u < 0.5 ? SKY.dawn : SKY.dusk;
    if (light.current) {
      light.current.position.set(Math.cos(ang) * 110, 40 + elev * 80, 50 - elev * 10);
      light.current.color.copy(SUN.noon).lerp(from, warm * 0.9);
      light.current.intensity = 1.1 + elev * 0.5;
    }
    sky.copy(SKY.noon).lerp(skyFrom, warm);
    scene.background = sky;
  });
  return (
    <directionalLight
      ref={light}
      position={[60, 100, 50]}
      intensity={1.5}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-120}
      shadow-camera-right={120}
      shadow-camera-top={120}
      shadow-camera-bottom={-120}
      shadow-bias={-0.0005}
    />
  );
}

const HOME_TARGET = new Vector3(5, 0, 2);
const HOME_OFFSET = new Vector3(90, 90, 113);
const HOME_ZOOM = 9;

/** Smooth camera: eases zoom and target, and glides to a truck when it is selected. */
function CameraRig() {
  const cmd = useUi((s) => s.cameraCmd);
  const selection = useUi((s) => s.selection);
  const { camera, controls, scene } = useThree() as unknown as {
    camera: { zoom: number; position: Vector3; updateProjectionMatrix: () => void };
    controls: { target: Vector3; update: () => void } | null;
    scene: { getObjectByName: (n: string) => (Group & { userData: { worldX?: number; worldZ?: number } }) | undefined };
  };
  const goal = useRef<{ target?: Vector3; zoom?: number; follow?: string }>({});

  useEffect(() => {
    if (cmd.n === 0 || useUi.getState().view !== "warehouse") return;
    if (cmd.action === "in") goal.current.zoom = Math.min(30, camera.zoom * 1.35);
    if (cmd.action === "out") goal.current.zoom = Math.max(3, camera.zoom / 1.35);
    if (cmd.action === "reset") goal.current = { target: HOME_TARGET.clone(), zoom: HOME_ZOOM };
  }, [cmd, camera]);

  useEffect(() => {
    if (selection?.kind === "truck") goal.current = { follow: `truck-${selection.id}`, zoom: Math.max(camera.zoom, 12) };
    else if (goal.current.follow) goal.current = {};
  }, [selection, camera]);

  useFrame((_, dt) => {
    if (!controls) return;
    const k = Math.min(1, dt * 4);
    const g = goal.current;
    let target = g.target;
    if (g.follow) {
      const obj = scene.getObjectByName(g.follow);
      if (obj?.visible && obj.userData.worldX !== undefined) target = new Vector3(obj.userData.worldX, 0, obj.userData.worldZ);
    }
    if (target) {
      const delta = target.clone().sub(controls.target).multiplyScalar(k);
      controls.target.add(delta);
      camera.position.add(delta);
      if (g.target && delta.lengthSq() < 1e-4) g.target = undefined;
    }
    if (g.zoom !== undefined) {
      camera.zoom += (g.zoom - camera.zoom) * k;
      camera.updateProjectionMatrix();
      if (Math.abs(g.zoom - camera.zoom) < 0.01) g.zoom = undefined;
    }
    if (cmd.action === "reset" && g.target) {
      // Also swing the camera back to the default angle.
      const want = controls.target.clone().add(HOME_OFFSET);
      camera.position.lerp(want, k);
    }
    controls.update();
  });
  return null;
}

export default function WarehouseScene() {
  const select = useUi((s) => s.select);
  const active = useUi((s) => s.view === "warehouse");
  const lowGfx = useUi((s) => s.lowGfx);
  const trucks = useUi((s) => s.trucks);
  const right = fenceRight(trucks.length);
  const trees = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = -66; x <= right - 4; x += 9) out.push([x, FENCE_Z - 3], [x + 4, -36]);
    for (let z = -30; z <= 36; z += 9) out.push([-66, z], [right - 4, z]);
    return out.filter(([x, z]) => !(Math.abs(x - GATE_X - 2) < 9 && z > 30) && !(Math.abs(x) < 9 && z < -30));
  }, [right]);
  return (
    <Canvas key={lowGfx ? "low" : "high"} shadows={!lowGfx} flat dpr={lowGfx ? 1 : [1, 2]} frameloop={active ? "always" : "never"} onPointerMissed={() => select(null)}>
      <OrthographicCamera makeDefault position={[95, 90, 115]} zoom={HOME_ZOOM} near={-500} far={1000} />
      <MapControls makeDefault target={[5, 0, 2]} enableDamping maxPolarAngle={1.2} minZoom={3} maxZoom={30} />
      <CameraRig />
      <hemisphereLight args={["#ffffff", "#dfe6f7", 1.6]} />
      <ambientLight intensity={0.5} />
      <DayLight />
      <Ground />
      <Fence />
      <Building />
      <Beci />
      <LoadingActivity place="rampa" />
      <LoadingActivity place="beci" />
      {trucks.map((t, i) => (
        <YardTruck key={t.id} truck={t} index={i} />
      ))}
      {/* forklift charging corner */}
      <group position={[-28, 0, 10]}>
        <Box size={[6, 0.05, 4]} pos={[0, 0.06, 0]} color="#cfe0ff" cast={false} />
        <ForkliftModel />
      </group>
      {trees.map((p, i) => (
        <Tree key={i} pos={p} s={0.8 + ((i * 37) % 10) / 25} />
      ))}
    </Canvas>
  );
}
