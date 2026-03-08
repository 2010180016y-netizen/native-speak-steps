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

// Breed config — proportions tuned per species
type BreedConfig = {
  bodyColor: string;
  bellyColor: string;
  earColor: string;
  noseColor: string;
  eyeColor: string;
  // Body
  bodyRadius: number;
  bodyLength: number;
  chestRadius: number;
  // Head
  headRadius: number;
  snoutRadius: number;
  snoutLength: number;
  jawDrop: number;
  // Ears
  earType: "floppy" | "erect" | "round" | "folded";
  earWidth: number;
  earHeight: number;
  // Legs
  legRadius: number;
  legHeight: number;
  pawRadius: number;
  // Tail
  tailSegments: number;
  tailBaseRadius: number;
  tailLength: number;
  tailCurl: number; // 0 = straight, 1+ = curled up
  tailWagSpeed: number;
  tailWagAmount: number;
  // Cat features
  isCat: boolean;
};

const BREEDS: Record<string, BreedConfig> = {
  dog: {
    bodyColor: "#d4883e", bellyColor: "#f0d0a0", earColor: "#b06820",
    noseColor: "#1a1a1a", eyeColor: "#4a2800",
    bodyRadius: 0.22, bodyLength: 0.45, chestRadius: 0.24,
    headRadius: 0.18, snoutRadius: 0.09, snoutLength: 0.12, jawDrop: 0.03,
    earType: "floppy", earWidth: 0.08, earHeight: 0.14,
    legRadius: 0.04, legHeight: 0.2, pawRadius: 0.05,
    tailSegments: 8, tailBaseRadius: 0.035, tailLength: 0.3, tailCurl: 0.3, tailWagSpeed: 8, tailWagAmount: 0.4,
    isCat: false,
  },
  corgi: {
    bodyColor: "#f0a030", bellyColor: "#fff5e6", earColor: "#d88020",
    noseColor: "#111", eyeColor: "#3a2000",
    bodyRadius: 0.24, bodyLength: 0.5, chestRadius: 0.26,
    headRadius: 0.17, snoutRadius: 0.08, snoutLength: 0.11, jawDrop: 0.025,
    earType: "erect", earWidth: 0.07, earHeight: 0.13,
    legRadius: 0.04, legHeight: 0.11, pawRadius: 0.05,
    tailSegments: 5, tailBaseRadius: 0.03, tailLength: 0.1, tailCurl: 0.2, tailWagSpeed: 10, tailWagAmount: 0.5,
    isCat: false,
  },
  shiba: {
    bodyColor: "#d4722a", bellyColor: "#ffe8cc", earColor: "#c05a10",
    noseColor: "#111", eyeColor: "#3a1a00",
    bodyRadius: 0.2, bodyLength: 0.42, chestRadius: 0.22,
    headRadius: 0.18, snoutRadius: 0.08, snoutLength: 0.1, jawDrop: 0.02,
    earType: "erect", earWidth: 0.065, earHeight: 0.11,
    legRadius: 0.038, legHeight: 0.2, pawRadius: 0.046,
    tailSegments: 10, tailBaseRadius: 0.04, tailLength: 0.3, tailCurl: 1.5, tailWagSpeed: 6, tailWagAmount: 0.2,
    isCat: false,
  },
  golden_retriever: {
    bodyColor: "#daa520", bellyColor: "#f5e6b8", earColor: "#c09018",
    noseColor: "#222", eyeColor: "#3a2000",
    bodyRadius: 0.26, bodyLength: 0.52, chestRadius: 0.28,
    headRadius: 0.2, snoutRadius: 0.1, snoutLength: 0.14, jawDrop: 0.035,
    earType: "floppy", earWidth: 0.1, earHeight: 0.16,
    legRadius: 0.045, legHeight: 0.25, pawRadius: 0.055,
    tailSegments: 10, tailBaseRadius: 0.04, tailLength: 0.35, tailCurl: 0.2, tailWagSpeed: 7, tailWagAmount: 0.5,
    isCat: false,
  },
  cat: {
    bodyColor: "#888888", bellyColor: "#cccccc", earColor: "#666666",
    noseColor: "#ffaaaa", eyeColor: "#44aa44",
    bodyRadius: 0.18, bodyLength: 0.4, chestRadius: 0.19,
    headRadius: 0.17, snoutRadius: 0.05, snoutLength: 0.05, jawDrop: 0.015,
    earType: "erect", earWidth: 0.06, earHeight: 0.1,
    legRadius: 0.032, legHeight: 0.18, pawRadius: 0.04,
    tailSegments: 12, tailBaseRadius: 0.025, tailLength: 0.4, tailCurl: 0.6, tailWagSpeed: 3, tailWagAmount: 0.15,
    isCat: true,
  },
  munchkin: {
    bodyColor: "#c0a070", bellyColor: "#f0e0c8", earColor: "#a08050",
    noseColor: "#ffbbbb", eyeColor: "#66bb66",
    bodyRadius: 0.18, bodyLength: 0.38, chestRadius: 0.2,
    headRadius: 0.18, snoutRadius: 0.045, snoutLength: 0.04, jawDrop: 0.01,
    earType: "round", earWidth: 0.055, earHeight: 0.08,
    legRadius: 0.032, legHeight: 0.1, pawRadius: 0.04,
    tailSegments: 10, tailBaseRadius: 0.022, tailLength: 0.3, tailCurl: 0.5, tailWagSpeed: 3.5, tailWagAmount: 0.12,
    isCat: true,
  },
  russian_blue: {
    bodyColor: "#7090a0", bellyColor: "#a0c0d0", earColor: "#5a7888",
    noseColor: "#ccaacc", eyeColor: "#33cc55",
    bodyRadius: 0.17, bodyLength: 0.42, chestRadius: 0.18,
    headRadius: 0.16, snoutRadius: 0.045, snoutLength: 0.04, jawDrop: 0.012,
    earType: "erect", earWidth: 0.065, earHeight: 0.11,
    legRadius: 0.03, legHeight: 0.2, pawRadius: 0.038,
    tailSegments: 12, tailBaseRadius: 0.022, tailLength: 0.38, tailCurl: 0.4, tailWagSpeed: 2.5, tailWagAmount: 0.1,
    isCat: true,
  },
  scottish_fold: {
    bodyColor: "#b0a090", bellyColor: "#e0d8c8", earColor: "#908070",
    noseColor: "#ffbbaa", eyeColor: "#55aa55",
    bodyRadius: 0.19, bodyLength: 0.38, chestRadius: 0.21,
    headRadius: 0.18, snoutRadius: 0.05, snoutLength: 0.04, jawDrop: 0.012,
    earType: "folded", earWidth: 0.06, earHeight: 0.06,
    legRadius: 0.033, legHeight: 0.17, pawRadius: 0.042,
    tailSegments: 10, tailBaseRadius: 0.024, tailLength: 0.32, tailCurl: 0.5, tailWagSpeed: 3, tailWagAmount: 0.12,
    isCat: true,
  },
};

// Create smooth body using multiple spheres along a spline
function SmoothBody({ config, breathe }: { config: BreedConfig; breathe: number }) {
  const segments = 6;
  return (
    <group>
      {Array.from({ length: segments }).map((_, i) => {
        const t = i / (segments - 1); // 0 to 1
        const z = (t - 0.5) * config.bodyLength * 2;
        // Chest is bigger at front
        const radiusMod = t < 0.3 ? config.chestRadius : config.bodyRadius * (1 - t * 0.15);
        const yOffset = t < 0.3 ? 0.01 : -t * 0.02;
        const breathMod = 1 + Math.sin(breathe) * 0.015;
        return (
          <mesh key={i} position={[0, yOffset, z]} castShadow>
            <sphereGeometry args={[radiusMod * breathMod, 12, 10]} />
            <meshStandardMaterial color={config.bodyColor} roughness={0.75} />
          </mesh>
        );
      })}
      {/* Belly underside */}
      {Array.from({ length: 4 }).map((_, i) => {
        const t = i / 3;
        const z = (t - 0.4) * config.bodyLength * 1.6;
        const r = config.bodyRadius * 0.7 * (1 - Math.abs(t - 0.4));
        return (
          <mesh key={`belly-${i}`} position={[0, -config.bodyRadius * 0.4, z]}>
            <sphereGeometry args={[r, 8, 6]} />
            <meshStandardMaterial color={config.bellyColor} roughness={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

// Animated leg
function Leg({
  basePos,
  config,
  phase,
  walkAmount,
}: {
  basePos: [number, number, number];
  config: BreedConfig;
  phase: number; // animation phase
  walkAmount: number; // 0=still, 1=full walk
}) {
  const upperRef = useRef<THREE.Group>(null!);
  const lowerRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!upperRef.current || !lowerRef.current) return;
    // Upper leg swing
    const swing = Math.sin(phase) * 0.4 * walkAmount;
    upperRef.current.rotation.x = swing;
    // Lower leg bends opposite
    lowerRef.current.rotation.x = Math.max(0, -Math.sin(phase) * 0.3) * walkAmount;
  });

  const halfLeg = config.legHeight * 0.5;

  return (
    <group position={basePos}>
      {/* Upper leg */}
      <group ref={upperRef}>
        <mesh position={[0, -halfLeg * 0.5, 0]} castShadow>
          <capsuleGeometry args={[config.legRadius, halfLeg, 6, 8]} />
          <meshStandardMaterial color={config.bodyColor} roughness={0.7} />
        </mesh>
        {/* Lower leg */}
        <group ref={lowerRef} position={[0, -halfLeg, 0]}>
          <mesh position={[0, -halfLeg * 0.5, 0]} castShadow>
            <capsuleGeometry args={[config.legRadius * 0.85, halfLeg, 6, 8]} />
            <meshStandardMaterial color={config.bodyColor} roughness={0.7} />
          </mesh>
          {/* Paw */}
          <mesh position={[0, -halfLeg - config.pawRadius * 0.3, config.pawRadius * 0.3]} castShadow>
            <sphereGeometry args={[config.pawRadius, 8, 6]} />
            <meshStandardMaterial color={config.bellyColor} roughness={0.8} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// Animated tail
function Tail({ config, time }: { config: BreedConfig; time: number }) {
  const refs = useRef<THREE.Mesh[]>([]);

  useFrame(() => {
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = i / (config.tailSegments - 1);
      const wag = Math.sin(time * config.tailWagSpeed + t * 2) * config.tailWagAmount * (0.5 + t * 0.5);
      const curl = config.tailCurl;
      const baseAngle = -0.3 + curl * t * 1.2;
      const y = Math.sin(baseAngle) * config.tailLength * t;
      const z = -Math.cos(baseAngle) * config.tailLength * t;
      const r = config.tailBaseRadius * (1 - t * 0.6);
      mesh.position.set(wag, y, z);
      mesh.scale.setScalar(r / config.tailBaseRadius);
    });
  });

  return (
    <group position={[0, config.bodyRadius * 0.3, -config.bodyLength]}>
      {Array.from({ length: config.tailSegments }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) refs.current[i] = el; }}
          castShadow
        >
          <sphereGeometry args={[config.tailBaseRadius, 6, 6]} />
          <meshStandardMaterial color={config.bodyColor} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// Head with snout, nose, eyes, mouth, ears
function Head({ config, breathe, time }: { config: BreedConfig; breathe: number; time: number }) {
  const headRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!headRef.current) return;
    // Gentle head bob
    headRef.current.rotation.x = Math.sin(breathe * 0.5) * 0.02;
    headRef.current.position.y = Math.sin(breathe) * 0.003;
  });

  const r = config.headRadius;

  return (
    <group
      ref={headRef}
      position={[0, config.bodyRadius * 0.6, config.bodyLength + r * 0.5]}
    >
      {/* Main head sphere */}
      <mesh castShadow>
        <sphereGeometry args={[r, 14, 12]} />
        <meshStandardMaterial color={config.bodyColor} roughness={0.7} />
      </mesh>

      {/* Cheeks */}
      <mesh position={[-r * 0.45, -r * 0.2, r * 0.3]}>
        <sphereGeometry args={[r * 0.35, 8, 6]} />
        <meshStandardMaterial color={config.bodyColor} roughness={0.75} />
      </mesh>
      <mesh position={[r * 0.45, -r * 0.2, r * 0.3]}>
        <sphereGeometry args={[r * 0.35, 8, 6]} />
        <meshStandardMaterial color={config.bodyColor} roughness={0.75} />
      </mesh>

      {/* Muzzle / snout area */}
      <mesh position={[0, -r * 0.25, r * 0.7 + config.snoutLength * 0.3]}>
        <sphereGeometry args={[config.snoutRadius, 10, 8]} />
        <meshStandardMaterial color={config.bellyColor} roughness={0.8} />
      </mesh>

      {/* Nose */}
      <mesh position={[0, -r * 0.15, r + config.snoutLength * 0.5]}>
        <sphereGeometry args={[config.snoutRadius * 0.4, 8, 6]} />
        <meshStandardMaterial color={config.noseColor} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Mouth line */}
      <mesh position={[0, -r * 0.3 - config.jawDrop, r * 0.7 + config.snoutLength * 0.2]}>
        <capsuleGeometry args={[0.008, config.snoutRadius * 0.5, 4, 6]} />
        <meshStandardMaterial color={config.noseColor} roughness={0.5} />
      </mesh>

      {/* Eyes */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * r * 0.45, r * 0.15, r * 0.65]}>
          {/* Eye white */}
          <mesh>
            <sphereGeometry args={[r * 0.15, 10, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          {/* Iris */}
          <mesh position={[0, 0, r * 0.1]}>
            <sphereGeometry args={[r * (config.isCat ? 0.11 : 0.09), 8, 8]} />
            <meshStandardMaterial color={config.eyeColor} roughness={0.4} />
          </mesh>
          {/* Pupil */}
          <mesh position={[0, 0, r * 0.14]}>
            <sphereGeometry args={[r * (config.isCat ? 0.04 : 0.05), 6, 6]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
          {/* Eye highlight */}
          <mesh position={[side * r * 0.04, r * 0.04, r * 0.15]}>
            <sphereGeometry args={[r * 0.025, 4, 4]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}

      {/* Eyebrows - subtle */}
      {([-1, 1] as const).map((side) => (
        <mesh key={`brow-${side}`} position={[side * r * 0.45, r * 0.35, r * 0.6]} rotation={[0, 0, side * 0.15]}>
          <capsuleGeometry args={[0.012, r * 0.15, 4, 4]} />
          <meshStandardMaterial color={config.earColor} roughness={0.8} />
        </mesh>
      ))}

      {/* Ears */}
      <Ears config={config} time={time} headRadius={r} />

      {/* Whiskers for cats */}
      {config.isCat && <Whiskers headRadius={r} snoutLength={config.snoutLength} />}
    </group>
  );
}

function Whiskers({ headRadius, snoutLength }: { headRadius: number; snoutLength: number }) {
  const r = headRadius;
  return (
    <>
      {([-1, 1] as const).map((side) =>
        [0, 1, 2].map((i) => (
          <mesh
            key={`w-${side}-${i}`}
            position={[side * r * 0.35, -r * 0.15 + (i - 1) * 0.02, r * 0.7 + snoutLength * 0.2]}
            rotation={[0, side * 0.3, (i - 1) * 0.12]}
          >
            <cylinderGeometry args={[0.002, 0.001, 0.15, 3]} />
            <meshStandardMaterial color="#444" />
          </mesh>
        ))
      )}
    </>
  );
}

function Ears({ config, time, headRadius }: { config: BreedConfig; time: number; headRadius: number }) {
  const leftRef = useRef<THREE.Group>(null!);
  const rightRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!leftRef.current || !rightRef.current) return;
    // Ear twitch
    const twitch = Math.sin(time * 1.5) * 0.03;
    if (config.earType === "floppy") {
      leftRef.current.rotation.z = 0.5 + twitch;
      rightRef.current.rotation.z = -0.5 - twitch;
      leftRef.current.rotation.x = 0.2 + Math.sin(time * 0.8) * 0.05;
      rightRef.current.rotation.x = 0.2 + Math.sin(time * 0.8 + 1) * 0.05;
    } else {
      leftRef.current.rotation.z = twitch * 2;
      rightRef.current.rotation.z = -twitch * 2;
    }
  });

  const r = headRadius;
  const w = config.earWidth;
  const h = config.earHeight;

  const EarShape = ({ side }: { side: number }) => {
    if (config.earType === "floppy") {
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[w, h, w * 0.3]} />
            <meshStandardMaterial color={config.earColor} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, w * 0.05]}>
            <boxGeometry args={[w * 0.6, h * 0.8, w * 0.15]} />
            <meshStandardMaterial color={config.bellyColor} roughness={0.85} />
          </mesh>
        </group>
      );
    }
    if (config.earType === "erect") {
      return (
        <group>
          <mesh castShadow>
            <coneGeometry args={[w, h, 4]} />
            <meshStandardMaterial color={config.earColor} roughness={0.75} />
          </mesh>
          <mesh position={[0, -h * 0.05, w * 0.1]}>
            <coneGeometry args={[w * 0.6, h * 0.7, 4]} />
            <meshStandardMaterial color={config.bellyColor} roughness={0.8} />
          </mesh>
        </group>
      );
    }
    if (config.earType === "round") {
      return (
        <group>
          <mesh castShadow>
            <sphereGeometry args={[w, 8, 6]} />
            <meshStandardMaterial color={config.earColor} roughness={0.75} />
          </mesh>
          <mesh position={[0, 0, w * 0.2]}>
            <sphereGeometry args={[w * 0.6, 6, 5]} />
            <meshStandardMaterial color={config.bellyColor} roughness={0.8} />
          </mesh>
        </group>
      );
    }
    // folded
    return (
      <group>
        <mesh castShadow rotation={[0.6, 0, 0]}>
          <boxGeometry args={[w, h, w * 0.25]} />
          <meshStandardMaterial color={config.earColor} roughness={0.8} />
        </mesh>
      </group>
    );
  };

  return (
    <>
      <group ref={leftRef} position={[-r * 0.5, r * 0.7, -r * 0.1]}>
        <EarShape side={-1} />
      </group>
      <group ref={rightRef} position={[r * 0.5, r * 0.7, -r * 0.1]}>
        <EarShape side={1} />
      </group>
    </>
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
  const walkPhaseRef = useRef(0);

  const config = useMemo(() => BREEDS[species] || BREEDS.dog, [species]);

  // Leg positions relative to body
  const legPositions = useMemo((): [number, number, number][] => {
    const bw = config.bodyRadius * 0.7;
    const bl = config.bodyLength;
    const yBase = -config.bodyRadius * 0.3;
    return [
      [-bw, yBase, bl * 0.7],   // front-left
      [bw, yBase, bl * 0.7],    // front-right
      [-bw, yBase, -bl * 0.6],  // back-left
      [bw, yBase, -bl * 0.6],   // back-right
    ];
  }, [config]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    timeRef.current += delta;
    const t = timeRef.current;

    // Movement toward target
    group.position.x += (targetPosition[0] - group.position.x) * delta * 1.5;
    group.position.z += (targetPosition[2] - group.position.z) * delta * 1.5;

    // Rotation toward target
    const dx = targetPosition[0] - group.position.x;
    const dz = targetPosition[2] - group.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      const target = Math.atan2(dx, dz);
      let diff = target - group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      group.rotation.y += diff * delta * 3;
    }

    // Walk phase
    const isMoving = action === "walking" || action === "playing" || feeding;
    const walkSpeed = action === "playing" ? 12 : feeding ? 10 : 8;
    if (isMoving) {
      walkPhaseRef.current += delta * walkSpeed;
    } else {
      walkPhaseRef.current *= 0.9; // slow down
    }

    // Vertical bounce
    if (feeding) {
      group.position.y = Math.abs(Math.sin(t * 5)) * 0.12;
    } else if (action === "walking") {
      group.position.y = Math.abs(Math.sin(walkPhaseRef.current)) * 0.02;
    } else if (action === "sleeping") {
      group.position.y = -0.05;
      group.rotation.z = 0.3 + Math.sin(t * 0.5) * 0.02;
    } else if (action === "playing") {
      group.position.y = Math.abs(Math.sin(t * 6)) * 0.08;
    } else {
      group.position.y = Math.sin(t * 2) * 0.01;
      group.rotation.z *= 0.95;
    }

    group.scale.setScalar(scale);
  });

  const breathe = timeRef.current * 2.5;
  const walkAmount = (action === "walking" || action === "playing") ? 1 : feeding ? 0.7 : 0;

  return (
    <group ref={groupRef} position={position}>
      {/* Body center offset to match leg positions */}
      <group position={[0, config.legHeight + config.bodyRadius * 0.7, 0]}>
        <SmoothBody config={config} breathe={breathe} />

        <Head config={config} breathe={breathe} time={timeRef.current} />

        <Tail config={config} time={timeRef.current} />
      </group>

      {/* Legs - animated */}
      <group position={[0, config.legHeight + config.bodyRadius * 0.4, 0]}>
        {legPositions.map((pos, i) => {
          // Diagonal gait: front-left + back-right are in phase, others are opposite
          const phaseOffset = (i === 0 || i === 3) ? 0 : Math.PI;
          return (
            <Leg
              key={i}
              basePos={pos}
              config={config}
              phase={walkPhaseRef.current + phaseOffset}
              walkAmount={walkAmount}
            />
          );
        })}
      </group>
    </group>
  );
}
