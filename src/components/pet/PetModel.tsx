import { useRef, useEffect, useMemo } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type PetAction = "idle" | "walking" | "sleeping" | "playing" | "eating";

type PetModelProps = {
  action: PetAction;
  position: [number, number, number];
  targetPosition: [number, number, number];
  scale?: number;
  species: string;
  petTypeName?: string;
  feeding: boolean;
};

// Map pet type name (Korean) to breed key
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
  return species; // fallback to "dog" or "cat"
}

// Map breed keys to GLB model files
const BREED_MODEL: Record<string, string> = {
  dog: "/models/husky.glb",
  corgi: "/models/fox.glb",
  shiba: "/models/shiba.glb",
  golden_retriever: "/models/wolf.glb",
  cat: "/models/cat.glb",
  munchkin: "/models/cat.glb",
  russian_blue: "/models/cat.glb",
  scottish_fold: "/models/cat.glb",
};

// Breed-specific color tints
const BREED_TINT: Record<string, { color: string; strength: number } | null> = {
  dog: null,
  corgi: { color: "#f0a030", strength: 0.5 },
  shiba: null,
  golden_retriever: { color: "#c8922a", strength: 0.7 },
  cat: { color: "#888888", strength: 0.35 },
  munchkin: { color: "#c0a070", strength: 0.45 },
  russian_blue: { color: "#7090a0", strength: 0.5 },
  scottish_fold: { color: "#b0a090", strength: 0.4 },
};

// Scale adjustments per breed
const BREED_SCALE: Record<string, number> = {
  dog: 1,
  corgi: 0.75,
  shiba: 1,
  golden_retriever: 1.15,
  cat: 0.85,
  munchkin: 0.7,
  russian_blue: 0.9,
  scottish_fold: 0.85,
};

// Find the best matching animation from the model's available animations
function findAnimation(animations: THREE.AnimationClip[], candidates: string[]): string | null {
  const names = animations.map((a) => a.name.toLowerCase());
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const found = animations.find((a) => a.name.toLowerCase().includes(lower));
    if (found) return found.name;
  }
  // Fall back to first animation
  return animations.length > 0 ? animations[0].name : null;
}

// Map pet actions to animation search terms
const ACTION_SEARCH: Record<PetAction, string[]> = {
  idle: ["idle", "survey", "sit", "stand"],
  walking: ["walk", "trot", "move"],
  sleeping: ["sleep", "rest", "idle", "sit", "survey"],
  playing: ["run", "gallop", "jump", "attack", "play"],
  eating: ["eat", "idle", "survey", "sit"],
};

export default function PetModel({
  action,
  position,
  targetPosition,
  scale = 1,
  species,
  petTypeName,
  feeding,
}: PetModelProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const breed = getBreedKey(species, petTypeName);
  const modelPath = BREED_MODEL[breed] || BREED_MODEL.dog;
  const { scene, animations } = useGLTF(modelPath);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, groupRef);

  // Log available animations (for debugging)
  useEffect(() => {
    console.log(
      `[PetModel] Species: ${species}, Model: ${modelPath}, Animations:`,
      animations.map((a) => a.name)
    );
  }, [species, modelPath, animations]);

  // Apply breed-based color tint
  useEffect(() => {
    const tint = BREED_TINT[breed];
    if (!tint) return;

    const color = new THREE.Color(tint.color);
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.color.lerp(color, tint.strength);
          mesh.material = mat;
        }
      }
    });
  }, [clonedScene, breed]);

  // Switch animations based on action
  useEffect(() => {
    const searchTerms = ACTION_SEARCH[action] || ACTION_SEARCH.idle;
    const animName = findAnimation(animations, searchTerms);
    if (!animName || !actions[animName]) return;

    const current = actions[animName]!;

    // Fade out all other animations, fade in current
    Object.values(actions).forEach((a) => {
      if (a && a !== current) a.fadeOut(0.4);
    });
    current.reset().fadeIn(0.4).play();

    // Slow down for sleeping
    if (action === "sleeping") {
      current.setEffectiveTimeScale(0.2);
    } else if (action === "playing") {
      current.setEffectiveTimeScale(1.3);
    } else {
      current.setEffectiveTimeScale(1);
    }
  }, [action, actions, animations]);

  // Smooth movement and rotation toward target
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    // Lerp position
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

    // Feeding bounce
    if (feeding) {
      group.position.y = Math.abs(Math.sin(Date.now() * 0.005)) * 0.3;
    } else if (action === "sleeping") {
      group.position.y = 0;
    } else {
      group.position.y = Math.sin(Date.now() * 0.003) * 0.05;
    }

    // Apply species-specific scale
    const scaleMod = SPECIES_SCALE_MOD[species] || 1;
    group.scale.setScalar(scale * scaleMod);
  });

  return (
    <group ref={groupRef} position={position}>
      <primitive object={clonedScene} />
    </group>
  );
}

// Preload all models
Object.values(SPECIES_MODEL).forEach((path) => {
  useGLTF.preload(path);
});
