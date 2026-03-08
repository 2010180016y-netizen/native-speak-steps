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
  feeding: boolean;
};

// Fox model animations: "Survey" (idle), "Walk", "Run"
const ACTION_MAP: Record<PetAction, string> = {
  idle: "Survey",
  walking: "Walk",
  sleeping: "Survey",
  playing: "Run",
  eating: "Survey",
};

export default function PetModel({
  action,
  position,
  targetPosition,
  scale = 0.012,
  species,
  feeding,
}: PetModelProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF("/models/fox.glb");
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, groupRef);

  // Apply species-based color tint
  useEffect(() => {
    const colorMap: Record<string, string> = {
      dog: "#ff8844",
      corgi: "#f0a030",
      shiba: "#d4722a",
      golden_retriever: "#daa520",
      cat: "#888888",
      munchkin: "#c0a070",
      russian_blue: "#7090a0",
      scottish_fold: "#b0a090",
    };
    const color = new THREE.Color(colorMap[species] || "#ff8844");
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.color.lerp(color, 0.3);
          mesh.material = mat;
        }
      }
    });
  }, [clonedScene, species]);

  // Switch animations
  useEffect(() => {
    const animName = ACTION_MAP[action] || "Survey";
    const current = actions[animName];
    if (!current) return;

    // Fade out all, fade in current
    Object.values(actions).forEach((a) => {
      if (a && a !== current) a.fadeOut(0.4);
    });
    current.reset().fadeIn(0.4).play();

    // Slow down for sleeping
    if (action === "sleeping") {
      current.setEffectiveTimeScale(0.2);
    } else {
      current.setEffectiveTimeScale(1);
    }
  }, [action, actions]);

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
      let currentAngle = group.rotation.y;
      // Shortest rotation path
      let diff = targetAngle - currentAngle;
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

    // Cat scale is smaller
    const speciesScale = species.includes("cat") || species === "munchkin" || species === "russian_blue" || species === "scottish_fold" ? scale * 0.8 : scale;
    group.scale.setScalar(speciesScale);
  });

  return (
    <group ref={groupRef} position={position}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload("/models/fox.glb");
