import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type PetAction = "idle" | "walking" | "sleeping" | "playing" | "eating";

type PetModelProps = {
  action: PetAction;
  position: [number, number, number];
  targetPosition: [number, number, number];
  scale?: number;
  species: string;
  feeding: boolean;
};

// Species visual configs
const SPECIES_CONFIG: Record<string, {
  bodyColor: string;
  bellyColor: string;
  earColor: string;
  noseColor: string;
  bodyWidth: number;
  bodyHeight: number;
  bodyDepth: number;
  headSize: number;
  earStyle: "floppy" | "pointed" | "round" | "folded";
  earSize: number;
  tailLength: number;
  tailCurve: number;
  legLength: number;
  snoutLength: number;
  eyeSize: number;
  eyeSpacing: number;
}> = {
  dog: {
    bodyColor: "#d4883e", bellyColor: "#f0d0a0", earColor: "#b06820",
    noseColor: "#222", bodyWidth: 0.5, bodyHeight: 0.45, bodyDepth: 0.8,
    headSize: 0.35, earStyle: "floppy", earSize: 0.15, tailLength: 0.4,
    tailCurve: 0.6, legLength: 0.3, snoutLength: 0.2, eyeSize: 0.06, eyeSpacing: 0.12,
  },
  corgi: {
    bodyColor: "#f0a030", bellyColor: "#fff5e0", earColor: "#d08020",
    noseColor: "#111", bodyWidth: 0.55, bodyHeight: 0.35, bodyDepth: 0.9,
    headSize: 0.34, earStyle: "pointed", earSize: 0.18, tailLength: 0.15,
    tailCurve: 0.3, legLength: 0.18, snoutLength: 0.22, eyeSize: 0.065, eyeSpacing: 0.11,
  },
  shiba: {
    bodyColor: "#d4722a", bellyColor: "#ffe8cc", earColor: "#c05a10",
    noseColor: "#111", bodyWidth: 0.45, bodyHeight: 0.45, bodyDepth: 0.75,
    headSize: 0.36, earStyle: "pointed", earSize: 0.16, tailLength: 0.45,
    tailCurve: 1.2, legLength: 0.32, snoutLength: 0.18, eyeSize: 0.055, eyeSpacing: 0.13,
  },
  golden_retriever: {
    bodyColor: "#daa520", bellyColor: "#f5e6b8", earColor: "#c09018",
    noseColor: "#222", bodyWidth: 0.55, bodyHeight: 0.5, bodyDepth: 0.95,
    headSize: 0.38, earStyle: "floppy", earSize: 0.2, tailLength: 0.55,
    tailCurve: 0.4, legLength: 0.35, snoutLength: 0.25, eyeSize: 0.07, eyeSpacing: 0.14,
  },
  cat: {
    bodyColor: "#888888", bellyColor: "#cccccc", earColor: "#666666",
    noseColor: "#ffaaaa", bodyWidth: 0.38, bodyHeight: 0.38, bodyDepth: 0.7,
    headSize: 0.33, earStyle: "pointed", earSize: 0.14, tailLength: 0.6,
    tailCurve: 0.8, legLength: 0.25, snoutLength: 0.08, eyeSize: 0.07, eyeSpacing: 0.11,
  },
  munchkin: {
    bodyColor: "#c0a070", bellyColor: "#f0e0c8", earColor: "#a08050",
    noseColor: "#ffbbbb", bodyWidth: 0.4, bodyHeight: 0.32, bodyDepth: 0.7,
    headSize: 0.35, earStyle: "round", earSize: 0.12, tailLength: 0.45,
    tailCurve: 0.6, legLength: 0.15, snoutLength: 0.07, eyeSize: 0.08, eyeSpacing: 0.1,
  },
  russian_blue: {
    bodyColor: "#7090a0", bellyColor: "#a0c0d0", earColor: "#5a7888",
    noseColor: "#ccaacc", bodyWidth: 0.38, bodyHeight: 0.42, bodyDepth: 0.72,
    headSize: 0.32, earStyle: "pointed", earSize: 0.15, tailLength: 0.55,
    tailCurve: 0.5, legLength: 0.28, snoutLength: 0.06, eyeSize: 0.075, eyeSpacing: 0.1,
  },
  scottish_fold: {
    bodyColor: "#b0a090", bellyColor: "#e0d8c8", earColor: "#908070",
    noseColor: "#ffbbaa", bodyWidth: 0.42, bodyHeight: 0.4, bodyDepth: 0.68,
    headSize: 0.36, earStyle: "folded", earSize: 0.11, tailLength: 0.45,
    tailCurve: 0.6, legLength: 0.24, snoutLength: 0.07, eyeSize: 0.08, eyeSpacing: 0.11,
  },
};

const isCat = (species: string) =>
  ["cat", "munchkin", "russian_blue", "scottish_fold"].includes(species);

function Ear({ side, style, size, color }: { side: "left" | "right"; style: string; size: number; color: string }) {
  const x = side === "left" ? -0.12 : 0.12;
  const baseY = 0.12;

  if (style === "floppy") {
    return (
      <mesh position={[x, baseY, 0]} rotation={[0, 0, side === "left" ? 0.4 : -0.4]}>
        <boxGeometry args={[size * 0.7, size * 1.5, size * 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }
  if (style === "pointed") {
    return (
      <mesh position={[x, baseY + size * 0.5, 0]}>
        <coneGeometry args={[size * 0.5, size * 1.2, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }
  if (style === "round") {
    return (
      <mesh position={[x, baseY + size * 0.3, 0]}>
        <sphereGeometry args={[size * 0.55, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }
  // folded
  return (
    <mesh position={[x, baseY, 0]} rotation={[0.5, 0, side === "left" ? 0.3 : -0.3]}>
      <boxGeometry args={[size * 0.8, size * 0.6, size * 0.3]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function PetGeometry({ config, species, time }: {
  config: typeof SPECIES_CONFIG[string];
  species: string;
  time: number;
}) {
  const catSpecies = isCat(species);

  return (
    <group>
      {/* Body */}
      <mesh position={[0, config.legLength + config.bodyHeight / 2, 0]} castShadow>
        <capsuleGeometry args={[config.bodyWidth / 2, config.bodyDepth * 0.4, 8, 16]} />
        <meshStandardMaterial color={config.bodyColor} roughness={0.7} />
      </mesh>

      {/* Belly */}
      <mesh position={[0, config.legLength + config.bodyHeight * 0.35, config.bodyDepth * 0.05]} castShadow>
        <sphereGeometry args={[config.bodyWidth * 0.42, 12, 12]} />
        <meshStandardMaterial color={config.bellyColor} roughness={0.8} />
      </mesh>

      {/* Head */}
      <group position={[0, config.legLength + config.bodyHeight + config.headSize * 0.5, config.bodyDepth * 0.35]}>
        <mesh castShadow>
          <sphereGeometry args={[config.headSize, 16, 16]} />
          <meshStandardMaterial color={config.bodyColor} roughness={0.7} />
        </mesh>

        {/* Snout */}
        <mesh position={[0, -config.headSize * 0.15, config.headSize * 0.7 + config.snoutLength * 0.3]}>
          <sphereGeometry args={[config.snoutLength * 0.6, 10, 10]} />
          <meshStandardMaterial color={config.bellyColor} roughness={0.8} />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -config.headSize * 0.1, config.headSize + config.snoutLength * 0.4]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color={config.noseColor} roughness={0.3} />
        </mesh>

        {/* Eyes */}
        {(["left", "right"] as const).map((side) => (
          <group key={side} position={[side === "left" ? -config.eyeSpacing : config.eyeSpacing, config.headSize * 0.1, config.headSize * 0.8]}>
            {/* Eye white */}
            <mesh>
              <sphereGeometry args={[config.eyeSize, 10, 10]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Pupil */}
            <mesh position={[0, 0, config.eyeSize * 0.5]}>
              <sphereGeometry args={[config.eyeSize * (catSpecies ? 0.55 : 0.5), 8, 8]} />
              <meshStandardMaterial color={catSpecies ? "#44aa44" : "#332211"} />
            </mesh>
            {/* Pupil dot */}
            <mesh position={[0, 0, config.eyeSize * 0.8]}>
              <sphereGeometry args={[config.eyeSize * 0.25, 6, 6]} />
              <meshStandardMaterial color="#111111" />
            </mesh>
          </group>
        ))}

        {/* Ears */}
        <Ear side="left" style={config.earStyle} size={config.earSize} color={config.earColor} />
        <Ear side="right" style={config.earStyle} size={config.earSize} color={config.earColor} />

        {/* Cat whiskers */}
        {catSpecies && (
          <>
            {[-1, 1].map((side) =>
              [0, 1, 2].map((i) => (
                <mesh
                  key={`whisker-${side}-${i}`}
                  position={[side * 0.12, -config.headSize * 0.05 + (i - 1) * 0.025, config.headSize * 0.75]}
                  rotation={[0, side * 0.2, (i - 1) * 0.15]}
                >
                  <cylinderGeometry args={[0.003, 0.001, 0.18, 4]} />
                  <meshStandardMaterial color="#333" />
                </mesh>
              ))
            )}
          </>
        )}
      </group>

      {/* Legs */}
      {[
        [-config.bodyWidth * 0.35, 0, config.bodyDepth * 0.2],
        [config.bodyWidth * 0.35, 0, config.bodyDepth * 0.2],
        [-config.bodyWidth * 0.35, 0, -config.bodyDepth * 0.2],
        [config.bodyWidth * 0.35, 0, -config.bodyDepth * 0.2],
      ].map((pos, i) => (
        <mesh key={`leg-${i}`} position={[pos[0], config.legLength / 2, pos[2]]} castShadow>
          <capsuleGeometry args={[0.055, config.legLength * 0.6, 6, 8]} />
          <meshStandardMaterial color={config.bodyColor} roughness={0.7} />
        </mesh>
      ))}

      {/* Paws */}
      {[
        [-config.bodyWidth * 0.35, 0, config.bodyDepth * 0.2],
        [config.bodyWidth * 0.35, 0, config.bodyDepth * 0.2],
        [-config.bodyWidth * 0.35, 0, -config.bodyDepth * 0.2],
        [config.bodyWidth * 0.35, 0, -config.bodyDepth * 0.2],
      ].map((pos, i) => (
        <mesh key={`paw-${i}`} position={[pos[0], 0.03, pos[2]]} castShadow>
          <sphereGeometry args={[0.065, 8, 8]} />
          <meshStandardMaterial color={config.bellyColor} roughness={0.8} />
        </mesh>
      ))}

      {/* Tail */}
      <group position={[0, config.legLength + config.bodyHeight * 0.7, -config.bodyDepth * 0.45]}>
        {Array.from({ length: 5 }).map((_, i) => {
          const t = i / 4;
          const curve = config.tailCurve;
          const y = Math.sin(t * Math.PI * 0.5) * config.tailLength * 0.5 + t * config.tailLength * 0.3;
          const z = -t * config.tailLength * 0.7;
          const wagX = Math.sin(time * 5 + t * 2) * 0.05 * (catSpecies ? 0.5 : 1);
          return (
            <mesh key={`tail-${i}`} position={[wagX, y, z]}>
              <sphereGeometry args={[0.04 - t * 0.008, 6, 6]} />
              <meshStandardMaterial color={config.bodyColor} roughness={0.7} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

export default function PetModel({
  action,
  position,
  targetPosition,
  scale = 1,
  species,
  feeding,
}: PetModelProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const timeRef = useRef(0);

  const config = useMemo(() => {
    return SPECIES_CONFIG[species] || SPECIES_CONFIG.dog;
  }, [species]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    timeRef.current += delta;
    const t = timeRef.current;

    // Lerp position toward target
    group.position.x += (targetPosition[0] - group.position.x) * delta * 1.5;
    group.position.z += (targetPosition[2] - group.position.z) * delta * 1.5;

    // Face movement direction
    const dx = targetPosition[0] - group.position.x;
    const dz = targetPosition[2] - group.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      const targetAngle = Math.atan2(dx, dz);
      let diff = targetAngle - group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      group.rotation.y += diff * delta * 3;
    }

    // Action-based animations
    if (feeding) {
      group.position.y = Math.abs(Math.sin(t * 5)) * 0.15;
    } else if (action === "walking") {
      group.position.y = Math.abs(Math.sin(t * 8)) * 0.04;
    } else if (action === "sleeping") {
      group.position.y = Math.sin(t * 1.5) * 0.01;
      // Slight tilt when sleeping
      group.rotation.z = Math.sin(t * 0.5) * 0.05;
    } else if (action === "playing") {
      group.position.y = Math.abs(Math.sin(t * 6)) * 0.1;
    } else {
      group.position.y = Math.sin(t * 2) * 0.02;
      group.rotation.z = 0;
    }

    // Scale based on level
    group.scale.setScalar(scale);
  });

  return (
    <group ref={groupRef} position={position}>
      <PetGeometry config={config} species={species} time={timeRef.current} />
    </group>
  );
}
