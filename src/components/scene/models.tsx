"use client";

import { RoundedBox } from "@react-three/drei";
import { forwardRef } from "react";
import { CanvasTexture, SRGBColorSpace, type Group } from "three";

type V3 = [number, number, number];

export function Box({ size, pos, color, opacity, cast = true, receive = true, onClick }: { size: V3; pos: V3; color: string; opacity?: number; cast?: boolean; receive?: boolean; onClick?: (e: { stopPropagation: () => void }) => void }) {
  return (
    <mesh position={pos} castShadow={cast} receiveShadow={receive} onClick={onClick}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} transparent={opacity !== undefined} opacity={opacity ?? 1} />
    </mesh>
  );
}

/** Box with softened edges, for the toy-like look of vehicles. */
export function RBox({ size, pos, color, radius = 0.25 }: { size: V3; pos: V3; color: string; radius?: number }) {
  return (
    <RoundedBox args={size} radius={radius} smoothness={3} position={pos} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.6} />
    </RoundedBox>
  );
}

let brandTexture: CanvasTexture | null = null;
/** "NOBIL PREST" lettering drawn once on a canvas (no font files to download). */
function getBrandTexture() {
  if (brandTexture) return brandTexture;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#1f3fb3";
  g.font = "800 84px Inter, 'Segoe UI', Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("NOBIL PREST", c.width / 2, c.height / 2 + 4);
  brandTexture = new CanvasTexture(c);
  brandTexture.colorSpace = SRGBColorSpace;
  brandTexture.anisotropy = 4;
  return brandTexture;
}

export function BrandSign({ pos, width, rotY = 0 }: { pos: V3; width: number; rotY?: number }) {
  return (
    <mesh position={pos} rotation={[0, rotY, 0]}>
      <planeGeometry args={[width, width / 8]} />
      <meshBasicMaterial map={getBrandTexture()} toneMapped={false} />
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
      <RBox size={[3, 3.3, 7]} pos={[0, 2.35, -1.2]} color="#fbfcff" radius={0.3} />
      <Box size={[3.02, 0.35, 6.8]} pos={[0, 1.05 + 0.35, -1.2]} color={color} cast={false} />
      <BrandSign pos={[1.52, 2.8, -1.2]} width={6} rotY={Math.PI / 2} />
      <BrandSign pos={[-1.52, 2.8, -1.2]} width={6} rotY={-Math.PI / 2} />
      {refrigerated && <RBox size={[2.2, 1, 0.5]} pos={[0, 3.4, 2.5]} color="#cfd8ea" radius={0.15} />}
      {/* cab */}
      <RBox size={[2.9, 2.6, 2.4]} pos={[0, 1.9, 3.5]} color={color} radius={0.4} />
      <Box size={[2.5, 1, 0.1]} pos={[0, 2.45, 4.72]} color="#1d2b4f" cast={false} />
      {[-1.05, 1.05].map((x) => (
        <Box key={x} size={[0.45, 0.3, 0.08]} pos={[x, 1.15, 4.72]} color="#fff6d6" cast={false} />
      ))}
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
      <RBox size={[1.4, 1, 2]} pos={[0, 0.8, 0]} color="#f5b81b" radius={0.15} />
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
        <sphereGeometry args={[1.4, 16, 12]} />
        <meshStandardMaterial color="#58c28d" roughness={0.8} />
      </mesh>
      <mesh position={[0.5, 3.9, 0.2]} castShadow>
        <sphereGeometry args={[0.9, 14, 10]} />
        <meshStandardMaterial color="#6bd19c" roughness={0.8} />
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
