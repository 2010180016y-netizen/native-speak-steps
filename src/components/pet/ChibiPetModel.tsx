import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type PetAction = "idle" | "walking" | "sleeping" | "playing" | "eating";
export type PetExpression = "normal" | "heart" | "star" | "sad" | "angry" | "happy" | "sleepy" | "surprised" | "sparkle";

type ChibiPetModelProps = {
  action: PetAction;
  position: [number, number, number];
  targetPosition: [number, number, number];
  scale?: number;
  species: string;
  petTypeName?: string;
  feeding: boolean;
  expression?: PetExpression;
};

// Breed visual configs
type BreedConfig = {
  bodyColor: string;
  bellyColor: string;
  earColor: string;
  eyeColor: string;
  noseColor: string;
  blushColor: string;
  earType: "pointy" | "floppy" | "round" | "folded";
  tailType: "curly" | "long" | "short" | "fluffy";
  bodyScale: [number, number, number];
  headScale: number;
};

const BREED_CONFIGS: Record<string, BreedConfig> = {
  dog: {
    bodyColor: "#a0815a", bellyColor: "#f0dcc0", earColor: "#7a6040",
    eyeColor: "#2c1810", noseColor: "#1a1a1a", blushColor: "#ff9999",
    earType: "floppy", tailType: "curly", bodyScale: [1, 1, 1], headScale: 1,
  },
  corgi: {
    bodyColor: "#f0a030", bellyColor: "#fff5e0", earColor: "#d08820",
    eyeColor: "#2c1810", noseColor: "#1a1a1a", blushColor: "#ffaaaa",
    earType: "pointy", tailType: "short", bodyScale: [1.1, 0.85, 1], headScale: 1.05,
  },
  shiba: {
    bodyColor: "#e8a040", bellyColor: "#fff8ee", earColor: "#c88830",
    eyeColor: "#1a1205", noseColor: "#1a1a1a", blushColor: "#ff9999",
    earType: "pointy", tailType: "curly", bodyScale: [1, 1, 1], headScale: 1.02,
  },
  golden_retriever: {
    bodyColor: "#c89030", bellyColor: "#ffe8c0", earColor: "#b07828",
    eyeColor: "#2c1810", noseColor: "#1a1a1a", blushColor: "#ffaaaa",
    earType: "floppy", tailType: "fluffy", bodyScale: [1.15, 1.1, 1.1], headScale: 1.08,
  },
  cat: {
    bodyColor: "#888888", bellyColor: "#d0d0d0", earColor: "#666666",
    eyeColor: "#3a7030", noseColor: "#ffaaaa", blushColor: "#ffbbbb",
    earType: "pointy", tailType: "long", bodyScale: [0.9, 0.95, 0.9], headScale: 1.05,
  },
  munchkin: {
    bodyColor: "#c8a070", bellyColor: "#fff0dd", earColor: "#a08050",
    eyeColor: "#4080a0", noseColor: "#ffaaaa", blushColor: "#ffcccc",
    earType: "round", tailType: "long", bodyScale: [0.85, 0.75, 0.85], headScale: 1.1,
  },
  russian_blue: {
    bodyColor: "#7090a8", bellyColor: "#b8c8d8", earColor: "#5a7888",
    eyeColor: "#50b050", noseColor: "#c0a0a0", blushColor: "#ddaacc",
    earType: "pointy", tailType: "long", bodyScale: [0.92, 1, 0.92], headScale: 1.03,
  },
  scottish_fold: {
    bodyColor: "#b0a090", bellyColor: "#e8ddd0", earColor: "#908070",
    eyeColor: "#d0a030", noseColor: "#ffaaaa", blushColor: "#ffbbbb",
    earType: "folded", tailType: "fluffy", bodyScale: [0.95, 0.9, 0.95], headScale: 1.08,
  },
};

function getBreedKey(species: string, petTypeName?: string): string {
  if (petTypeName) {
    const name = petTypeName.toLowerCase();
    if (name.includes("코르기") || name.includes("corgi")) return "corgi";
    if (name.includes("시바") || name.includes("shiba")) return "shiba";
    if (name.includes("골든") || name.includes("golden")) return "golden_retriever";
    if (name.includes("먼치킨") || name.includes("munchkin")) return "munchkin";
    if (name.includes("러시안") || name.includes("russian")) return "russian_blue";
    if (name.includes("스코티시") || name.includes("scottish")) return "scottish_fold";
  }
  return species;
}

/** A single chibi ear */
function ChibiEar({ side, config }: { side: "left" | "right"; config: BreedConfig }) {
  const xSign = side === "left" ? -1 : 1;
  const earMat = useMemo(() => new THREE.MeshToonMaterial({ color: config.earColor }), [config.earColor]);
  const innerMat = useMemo(() => new THREE.MeshToonMaterial({ color: config.blushColor }), [config.blushColor]);

  if (config.earType === "pointy") {
    return (
      <group position={[xSign * 0.28, 0.35, 0]}>
        <mesh material={earMat} rotation={[0, 0, xSign * -0.3]}>
          <coneGeometry args={[0.12, 0.28, 8]} />
        </mesh>
        <mesh material={innerMat} rotation={[0, 0, xSign * -0.3]} position={[0, -0.02, 0.02]}>
          <coneGeometry args={[0.06, 0.18, 8]} />
        </mesh>
      </group>
    );
  }
  if (config.earType === "floppy") {
    return (
      <group position={[xSign * 0.32, 0.2, 0]}>
        <mesh material={earMat} rotation={[0.3, 0, xSign * 0.8]}>
          <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
        </mesh>
      </group>
    );
  }
  if (config.earType === "folded") {
    return (
      <group position={[xSign * 0.28, 0.28, 0]}>
        <mesh material={earMat} rotation={[0.5, 0, xSign * 0.3]}>
          <capsuleGeometry args={[0.1, 0.1, 4, 8]} />
        </mesh>
      </group>
    );
  }
  // round
  return (
    <group position={[xSign * 0.28, 0.32, 0]}>
      <mesh material={earMat}>
        <sphereGeometry args={[0.1, 12, 12]} />
      </mesh>
      <mesh material={innerMat} position={[0, 0, 0.03]}>
        <sphereGeometry args={[0.05, 8, 8]} />
      </mesh>
    </group>
  );
}

/** Chibi tail */
function ChibiTail({ config }: { config: BreedConfig }) {
  const mat = useMemo(() => new THREE.MeshToonMaterial({ color: config.bodyColor }), [config.bodyColor]);
  
  if (config.tailType === "curly") {
    return (
      <group position={[0, 0.15, -0.35]}>
        <mesh material={mat} rotation={[-0.8, 0, 0]}>
          <capsuleGeometry args={[0.05, 0.18, 4, 8]} />
        </mesh>
        <mesh material={mat} position={[0, 0.12, -0.05]}>
          <sphereGeometry args={[0.06, 8, 8]} />
        </mesh>
      </group>
    );
  }
  if (config.tailType === "long") {
    return (
      <group position={[0, 0.1, -0.35]}>
        <mesh material={mat} rotation={[-1.2, 0, 0]}>
          <capsuleGeometry args={[0.04, 0.35, 4, 8]} />
        </mesh>
        <mesh material={mat} position={[0, 0.2, -0.15]}>
          <sphereGeometry args={[0.05, 8, 8]} />
        </mesh>
      </group>
    );
  }
  if (config.tailType === "fluffy") {
    return (
      <group position={[0, 0.12, -0.35]}>
        <mesh material={mat} rotation={[-0.6, 0, 0]}>
          <capsuleGeometry args={[0.07, 0.22, 4, 8]} />
        </mesh>
        <mesh material={mat} position={[0, 0.15, -0.06]}>
          <sphereGeometry args={[0.09, 8, 8]} />
        </mesh>
      </group>
    );
  }
  // short
  return (
    <group position={[0, 0.15, -0.3]}>
      <mesh material={mat}>
        <sphereGeometry args={[0.07, 8, 8]} />
      </mesh>
    </group>
  );
}

export default function ChibiPetModel({
  action,
  position,
  targetPosition,
  scale = 0.8,
  species,
  petTypeName,
  feeding,
}: ChibiPetModelProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const headRef = useRef<THREE.Group>(null!);
  const bodyRef = useRef<THREE.Group>(null!);
  const legLRef = useRef<THREE.Mesh>(null!);
  const legRRef = useRef<THREE.Mesh>(null!);
  const legBLRef = useRef<THREE.Mesh>(null!);
  const legBRRef = useRef<THREE.Mesh>(null!);
  const tailRef = useRef<THREE.Group>(null!);
  const eyeLRef = useRef<THREE.Group>(null!);
  const eyeRRef = useRef<THREE.Group>(null!);

  const breed = getBreedKey(species, petTypeName);
  const config = BREED_CONFIGS[breed] || BREED_CONFIGS.dog;

  const bodyMat = useMemo(() => new THREE.MeshToonMaterial({ color: config.bodyColor }), [config.bodyColor]);
  const bellyMat = useMemo(() => new THREE.MeshToonMaterial({ color: config.bellyColor }), [config.bellyColor]);
  const eyeWhiteMat = useMemo(() => new THREE.MeshToonMaterial({ color: "#ffffff" }), []);
  const eyeMat = useMemo(() => new THREE.MeshToonMaterial({ color: config.eyeColor }), [config.eyeColor]);
  const eyeHighlightMat = useMemo(() => new THREE.MeshToonMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.5 }), []);
  const noseMat = useMemo(() => new THREE.MeshToonMaterial({ color: config.noseColor }), [config.noseColor]);
  const blushMat = useMemo(() => new THREE.MeshToonMaterial({ color: config.blushColor, transparent: true, opacity: 0.5 }), [config.blushColor]);
  const mouthMat = useMemo(() => new THREE.MeshToonMaterial({ color: "#4a3020" }), []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const g = groupRef.current;
    const t = Date.now() * 0.001;

    // Movement
    const moveSpeed = action === "walking" ? 1.2 : 2.0;
    g.position.x += (targetPosition[0] - g.position.x) * delta * moveSpeed;
    g.position.z += (targetPosition[2] - g.position.z) * delta * moveSpeed;

    // Face direction
    const dx = targetPosition[0] - g.position.x;
    const dz = targetPosition[2] - g.position.z;
    if (Math.abs(dx) > 0.02 || Math.abs(dz) > 0.02) {
      const targetAngle = Math.atan2(dx, dz);
      let diff = targetAngle - g.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      g.rotation.y += diff * delta * 5;
    }

    // === Animations by action ===
    if (feeding) {
      // Happy bouncing
      g.position.y = Math.abs(Math.sin(t * 8)) * 0.3;
      if (headRef.current) headRef.current.rotation.z = Math.sin(t * 6) * 0.15;
      if (tailRef.current) tailRef.current.rotation.x = Math.sin(t * 12) * 0.5;
    } else if (action === "sleeping") {
      g.position.y = 0;
      // Gentle breathing
      if (bodyRef.current) bodyRef.current.scale.y = 1 + Math.sin(t * 1.5) * 0.03;
      if (headRef.current) {
        headRef.current.rotation.z = 0.15; // tilted
        headRef.current.position.y = 0.42 + Math.sin(t * 1.5) * 0.01;
      }
      // Closed eyes (squished)
      if (eyeLRef.current) eyeLRef.current.scale.y = 0.1;
      if (eyeRRef.current) eyeRRef.current.scale.y = 0.1;
    } else if (action === "walking") {
      // Bobbing walk
      g.position.y = Math.abs(Math.sin(t * 5)) * 0.08;
      if (headRef.current) headRef.current.rotation.z = Math.sin(t * 5) * 0.06;
      // Leg animation
      if (legLRef.current) legLRef.current.position.y = -0.18 + Math.sin(t * 10) * 0.04;
      if (legRRef.current) legRRef.current.position.y = -0.18 + Math.sin(t * 10 + Math.PI) * 0.04;
      if (legBLRef.current) legBLRef.current.position.y = -0.18 + Math.sin(t * 10 + Math.PI) * 0.04;
      if (legBRRef.current) legBRRef.current.position.y = -0.18 + Math.sin(t * 10) * 0.04;
      if (tailRef.current) tailRef.current.rotation.z = Math.sin(t * 8) * 0.4;
      // Open eyes
      if (eyeLRef.current) eyeLRef.current.scale.y = 1;
      if (eyeRRef.current) eyeRRef.current.scale.y = 1;
    } else if (action === "playing") {
      // Excited bouncing
      g.position.y = Math.abs(Math.sin(t * 7)) * 0.2;
      if (headRef.current) headRef.current.rotation.z = Math.sin(t * 4) * 0.2;
      if (tailRef.current) tailRef.current.rotation.z = Math.sin(t * 14) * 0.6;
      if (eyeLRef.current) eyeLRef.current.scale.y = 1;
      if (eyeRRef.current) eyeRRef.current.scale.y = 1;
    } else if (action === "eating") {
      g.position.y = 0;
      // Head bobbing down
      if (headRef.current) {
        headRef.current.rotation.x = Math.sin(t * 6) * 0.15 - 0.1;
      }
      if (tailRef.current) tailRef.current.rotation.z = Math.sin(t * 5) * 0.3;
      if (eyeLRef.current) eyeLRef.current.scale.y = 0.7;
      if (eyeRRef.current) eyeRRef.current.scale.y = 0.7;
    } else {
      // Idle
      g.position.y = Math.sin(t * 2) * 0.04;
      if (headRef.current) {
        headRef.current.rotation.z = Math.sin(t * 1.5) * 0.04;
        headRef.current.rotation.x = 0;
        headRef.current.position.y = 0.42;
      }
      if (bodyRef.current) bodyRef.current.scale.y = 1 + Math.sin(t * 2) * 0.02;
      if (tailRef.current) tailRef.current.rotation.z = Math.sin(t * 3) * 0.2;
      // Occasional blink
      const blink = Math.sin(t * 0.5) > 0.98;
      if (eyeLRef.current) eyeLRef.current.scale.y = blink ? 0.1 : 1;
      if (eyeRRef.current) eyeRRef.current.scale.y = blink ? 0.1 : 1;
    }

    g.scale.setScalar(scale);
  });

  const [bx, by, bz] = config.bodyScale;

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <group ref={bodyRef} scale={[bx, by, bz]}>
        <mesh material={bodyMat} position={[0, 0.18, 0]} castShadow>
          <sphereGeometry args={[0.28, 16, 16]} />
        </mesh>
        {/* Belly */}
        <mesh material={bellyMat} position={[0, 0.15, 0.12]} castShadow>
          <sphereGeometry args={[0.2, 12, 12]} />
        </mesh>
      </group>

      {/* Head */}
      <group ref={headRef} position={[0, 0.42, 0.05]}>
        <mesh material={bodyMat} castShadow>
          <sphereGeometry args={[0.3 * config.headScale, 20, 20]} />
        </mesh>

        {/* Face (lighter area) */}
        <mesh material={bellyMat} position={[0, -0.05, 0.18]}>
          <sphereGeometry args={[0.18 * config.headScale, 12, 12]} />
        </mesh>

        {/* Eyes */}
        <group ref={eyeLRef} position={[-0.11, 0.04, 0.22]}>
          <mesh material={eyeWhiteMat}>
            <sphereGeometry args={[0.07, 12, 12]} />
          </mesh>
          <mesh material={eyeMat} position={[0, 0, 0.04]}>
            <sphereGeometry args={[0.05, 10, 10]} />
          </mesh>
          {/* Highlight */}
          <mesh material={eyeHighlightMat} position={[0.02, 0.02, 0.07]}>
            <sphereGeometry args={[0.02, 6, 6]} />
          </mesh>
        </group>
        <group ref={eyeRRef} position={[0.11, 0.04, 0.22]}>
          <mesh material={eyeWhiteMat}>
            <sphereGeometry args={[0.07, 12, 12]} />
          </mesh>
          <mesh material={eyeMat} position={[0, 0, 0.04]}>
            <sphereGeometry args={[0.05, 10, 10]} />
          </mesh>
          <mesh material={eyeHighlightMat} position={[0.02, 0.02, 0.07]}>
            <sphereGeometry args={[0.02, 6, 6]} />
          </mesh>
        </group>

        {/* Nose */}
        <mesh material={noseMat} position={[0, -0.06, 0.28]}>
          <sphereGeometry args={[0.035, 8, 8]} />
        </mesh>

        {/* Mouth (small smile line) */}
        <mesh material={mouthMat} position={[-0.03, -0.1, 0.26]}>
          <boxGeometry args={[0.06, 0.008, 0.01]} />
        </mesh>
        <mesh material={mouthMat} position={[0.03, -0.1, 0.26]}>
          <boxGeometry args={[0.06, 0.008, 0.01]} />
        </mesh>

        {/* Blush */}
        <mesh material={blushMat} position={[-0.18, -0.04, 0.18]}>
          <sphereGeometry args={[0.04, 8, 8]} />
        </mesh>
        <mesh material={blushMat} position={[0.18, -0.04, 0.18]}>
          <sphereGeometry args={[0.04, 8, 8]} />
        </mesh>

        {/* Ears */}
        <ChibiEar side="left" config={config} />
        <ChibiEar side="right" config={config} />
      </group>

      {/* Legs (stubby) */}
      <mesh ref={legLRef} material={bodyMat} position={[-0.14, -0.18, 0.1]} castShadow>
        <capsuleGeometry args={[0.06, 0.12, 4, 8]} />
      </mesh>
      <mesh ref={legRRef} material={bodyMat} position={[0.14, -0.18, 0.1]} castShadow>
        <capsuleGeometry args={[0.06, 0.12, 4, 8]} />
      </mesh>
      <mesh ref={legBLRef} material={bodyMat} position={[-0.14, -0.18, -0.12]} castShadow>
        <capsuleGeometry args={[0.06, 0.12, 4, 8]} />
      </mesh>
      <mesh ref={legBRRef} material={bodyMat} position={[0.14, -0.18, -0.12]} castShadow>
        <capsuleGeometry args={[0.06, 0.12, 4, 8]} />
      </mesh>

      {/* Tail */}
      <group ref={tailRef}>
        <ChibiTail config={config} />
      </group>
    </group>
  );
}
