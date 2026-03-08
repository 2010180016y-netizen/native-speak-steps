import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type AccessoryProps = {
  position: string; // "top" | "face" | "neck" | "back"
  category: string; // "hat" | "glasses" | "ribbon" | "special"
  name: string;
  petPosition: [number, number, number];
  petScale: number;
};

const POSITION_OFFSETS: Record<string, [number, number, number]> = {
  top: [0, 1.8, 0],
  face: [0, 1.2, 0.4],
  neck: [0, 0.6, 0.2],
  back: [0, 1.4, -0.3],
};

const ACCESSORY_CONFIGS: Record<string, {
  geometry: "box" | "sphere" | "torus" | "cone" | "cylinder";
  color: string;
  scale: [number, number, number];
  emissive?: string;
}> = {
  // Hats
  "꽃 왕관": { geometry: "torus", color: "#ff69b4", scale: [0.3, 0.3, 0.1], emissive: "#ff1493" },
  "파티 모자": { geometry: "cone", color: "#ff4500", scale: [0.2, 0.4, 0.2], emissive: "#ff6347" },
  "왕관": { geometry: "cylinder", color: "#ffd700", scale: [0.25, 0.15, 0.25], emissive: "#ffaa00" },
  // Glasses
  "별 선글라스": { geometry: "torus", color: "#1e90ff", scale: [0.35, 0.15, 0.05], emissive: "#4169e1" },
  "하트 안경": { geometry: "torus", color: "#ff1493", scale: [0.35, 0.15, 0.05], emissive: "#ff69b4" },
  "마법사 안경": { geometry: "sphere", color: "#9370db", scale: [0.15, 0.15, 0.05], emissive: "#8a2be2" },
  // Ribbons
  "빨간 리본": { geometry: "box", color: "#ff0000", scale: [0.3, 0.1, 0.05], emissive: "#cc0000" },
  "진주 목걸이": { geometry: "torus", color: "#fffaf0", scale: [0.3, 0.3, 0.06], emissive: "#f5f5dc" },
  "종 목걸이": { geometry: "sphere", color: "#ffd700", scale: [0.12, 0.12, 0.12], emissive: "#daa520" },
  // Special
  "천사 날개": { geometry: "box", color: "#ffffff", scale: [0.6, 0.4, 0.05], emissive: "#f0f8ff" },
  "무지개 망토": { geometry: "box", color: "#ff6ec7", scale: [0.5, 0.5, 0.05], emissive: "#da70d6" },
  "별빛 이펙트": { geometry: "sphere", color: "#ffff00", scale: [0.08, 0.08, 0.08], emissive: "#ffd700" },
};

const GeometryComponent = ({ type, scale }: { type: string; scale: [number, number, number] }) => {
  switch (type) {
    case "cone":
      return <coneGeometry args={[scale[0], scale[1], 8]} />;
    case "sphere":
      return <sphereGeometry args={[scale[0], 16, 16]} />;
    case "torus":
      return <torusGeometry args={[scale[0], scale[2] || 0.05, 8, 24]} />;
    case "cylinder":
      return <cylinderGeometry args={[scale[0], scale[0] * 1.2, scale[1], 12]} />;
    default:
      return <boxGeometry args={scale} />;
  }
};

export default function Pet3DAccessory({
  position,
  category,
  name,
  petPosition,
  petScale,
}: AccessoryProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const config = ACCESSORY_CONFIGS[name] || {
    geometry: "sphere" as const,
    color: "#ff69b4",
    scale: [0.15, 0.15, 0.15] as [number, number, number],
  };
  const offset = POSITION_OFFSETS[position] || POSITION_OFFSETS.top;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    // Float/bob animation
    meshRef.current.position.set(
      petPosition[0] + offset[0],
      petPosition[1] + offset[1] + Math.sin(Date.now() * 0.003) * 0.05,
      petPosition[2] + offset[2]
    );
    // Gentle rotation for special items
    if (category === "special" || name === "별빛 이펙트") {
      meshRef.current.rotation.y += delta * 1.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <GeometryComponent type={config.geometry} scale={config.scale} />
      <meshStandardMaterial
        color={config.color}
        emissive={config.emissive || config.color}
        emissiveIntensity={0.3}
        metalness={0.4}
        roughness={0.3}
      />
    </mesh>
  );
}
