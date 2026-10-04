"use client";

import { forwardRef } from "react";
import type { Group } from "three";

type V3 = [number, number, number];

export function Box({ size, pos, color, opacity, cast = true, receive = true, onClick }: { size: V3; pos: V3; color: string; opacity?: number; cast?: boolean; receive?: boolean; onClick?: (e: { stopPropagation: () => void }) => void }) {
  return (
    <mesh position={pos} castShadow={cast} receiveShadow={receive} onClick={onClick}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} transparent={opacity !== undefined} opacity={opacity ?? 1} />
    </mesh>
  );
}

/** Low-poly truck. Local forward is +z (the cab end). */
export const TruckModel = forwardRef<Group, { color: string; refrigerated: boolean; onClick?: () => void; onHover?: (h: boolean) => void }>(function TruckModel({ color, refrigerated, onClick, onHover }, ref) {
  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover?.(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover?.(false);
        document.body.style.cursor = "";
      }}
    >
      {/* cargo box */}
      <Box size={[3, 3.3, 7]} pos={[0, 2.35, -1.2]} color="#fbfcff" />
      <Box size={[3.02, 0.5, 6.4]} pos={[0, 2.4, -1.2]} color={color} cast={false} />
      {refrigerated && <Box size={[2.2, 1, 0.5]} pos={[0, 3.4, 2.5]} color="#cfd8ea" />}
      {/* cab */}
      <Box size={[2.9, 2.5, 2.3]} pos={[0, 1.85, 3.5]} color={color} />
      <Box size={[2.6, 1, 0.1]} pos={[0, 2.4, 4.66]} color="#1d2b4f" cast={false} />
      {/* chassis + wheels */}
      <Box size={[2.6, 0.5, 9.6]} pos={[0, 0.75, 0]} color="#3a4256" />
      {[-3.6, -1.6, 3.3].map((z) =>
        [-1.35, 1.35].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 0.55, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.5, 14]} />
            <meshStandardMaterial color="#20242e" roughness={0.9} />
          </mesh>
        )),
      )}
    </group>
  );
});

export const ForkliftModel = forwardRef<Group, { carrying?: boolean }>(function ForkliftModel({ carrying }, ref) {
  return (
    <group ref={ref}>
      <Box size={[1.4, 1, 2]} pos={[0, 0.8, 0]} color="#f5b81b" />
      <Box size={[1.3, 0.1, 1.3]} pos={[0, 2.3, -0.2]} color="#2a2f3a" />
      {[-0.55, 0.55].map((x) => (
        <Box key={x} size={[0.1, 2, 0.1]} pos={[x, 1.3, -0.75]} color="#2a2f3a" />
      ))}
      <Box size={[0.1, 2.3, 0.1]} pos={[0, 1.4, 1.05]} color="#2a2f3a" />
      <Box size={[1.1, 0.1, 1]} pos={[0, 0.35, 1.5]} color="#4a505e" />
      {carrying && <Box size={[1.1, 0.8, 1.1]} pos={[0, 0.85, 1.5]} color="#d8b37a" />}
      {[-0.65, 0.65].map((x) =>
        [-0.6, 0.6].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.3, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.3, 0.3, 0.3, 10]} />
            <meshStandardMaterial color="#20242e" />
          </mesh>
        )),
      )}
    </group>
  );
});

export function Tree({ pos, s = 1 }: { pos: [number, number]; s?: number }) {
  return (
    <group position={[pos[0], 0, pos[1]]} scale={s}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.25, 2, 6]} />
        <meshStandardMaterial color="#9a7b5c" />
      </mesh>
      <mesh position={[0, 3, 0]} castShadow>
        <sphereGeometry args={[1.4, 12, 10]} />
        <meshStandardMaterial color="#58c28d" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Pallet with goods; `color` tints the load. */
export function Pallet({ pos, color = "#d8b37a", h = 1.1 }: { pos: V3; color?: string; h?: number }) {
  return (
    <group position={pos}>
      <Box size={[1.3, 0.18, 1.3]} pos={[0, 0.09, 0]} color="#b48a5a" />
      <Box size={[1.2, h, 1.2]} pos={[0, 0.18 + h / 2, 0]} color={color} />
    </group>
  );
}
