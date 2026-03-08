import { Suspense, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { motion, AnimatePresence } from "framer-motion";
import PetModel from "./PetModel";
import Pet3DAccessory from "./Pet3DAccessory";
import Room from "./Pet3DRoom";
import * as THREE from "three";

type PetAction = "idle" | "walking" | "sleeping" | "playing" | "eating";

type Pet3DSceneProps = {
  petName: string;
  petLevel: number;
  species: string;
  petTypeName?: string;
  equippedAccessories: { emoji: string; position: string; name?: string; category?: string }[];
  emotion: { emoji: string; text: string } | null;
  petAction: PetAction;
  feeding: boolean;
  onTap: () => void;
};

/** Camera smoothly follows the pet */
function CameraFollower({ targetPos }: { targetPos: [number, number, number] }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const tx = targetPos[0] * 0.45;
    const tz = targetPos[2] * 0.25;

    const desired = new THREE.Vector3(tx, 4, tz + 6);
    camera.position.lerp(desired, delta * 1.0);

    const look = new THREE.Vector3(tx, 0.5, tz - 1);
    camera.lookAt(look);
  });

  return null;
}

function LoadingFallback() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshStandardMaterial color="#ff8844" emissive="#ff6600" emissiveIntensity={0.3} />
    </mesh>
  );
}

export default function Pet3DScene({
  petName,
  petLevel,
  species,
  petTypeName,
  equippedAccessories,
  emotion,
  petAction,
  feeding,
  onTap,
}: Pet3DSceneProps) {
  const [targetPos, setTargetPos] = useState<[number, number, number]>([0, 0, 0]);
  const petScale = Math.min(0.01 + (petLevel - 1) * 0.0005, 0.018);

  // Wander logic
  useEffect(() => {
    if (feeding) return;
    const wander = () => {
      if (petAction === "walking") {
        setTargetPos([
          -3.5 + Math.random() * 7,
          0,
          -3.5 + Math.random() * 5.5,
        ]);
      } else if (petAction === "sleeping") {
        setTargetPos([-2.5, 0, -2]);
      } else if (petAction === "eating") {
        setTargetPos([2.5, 0, -3]);
      }
    };
    wander();
    const id = setInterval(wander, 2000 + Math.random() * 1500);
    return () => clearInterval(id);
  }, [petAction, feeding]);

  useEffect(() => {
    if (feeding) setTargetPos([0, 0, 0]);
  }, [feeding]);

  return (
    <div
      className="w-full rounded-2xl overflow-hidden border-2 border-border shadow-lg cursor-pointer select-none relative"
      style={{ height: 340 }}
      onClick={onTap}
    >
      <Canvas
        shadows
        camera={{ position: [0, 4, 6], fov: 45, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        style={{ background: "linear-gradient(180deg, #87CEEB 0%, #E0F0FF 100%)" }}
      >
        {/* ─── Lighting ─── */}
        <ambientLight intensity={0.35} color="#fef3e2" />
        <directionalLight
          position={[2, 8, 4]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0001}
          color="#fff5e6"
        />
        {/* Window light (warm) */}
        <spotLight
          position={[0, 4.5, -4]}
          angle={0.5}
          penumbra={0.8}
          intensity={0.8}
          color="#ffeedd"
          castShadow={false}
        />
        {/* Fill light */}
        <pointLight position={[-3, 2, 2]} intensity={0.2} color="#e0d0c0" />
        {/* Rim light */}
        <pointLight position={[3, 1, 3]} intensity={0.15} color="#c0d0e0" />

        {/* ─── Environment (soft reflections) ─── */}
        <Environment preset="apartment" environmentIntensity={0.15} />

        {/* ─── Room ─── */}
        <Room />

        {/* ─── Shadows ─── */}
        <ContactShadows position={[0, 0.01, 0]} opacity={0.6} scale={12} blur={2.5} far={5} />

        {/* ─── Pet ─── */}
        <Suspense fallback={<LoadingFallback />}>
          <PetModel
            action={petAction}
            position={[0, 0, 0]}
            targetPosition={targetPos}
            scale={petScale}
            species={species}
            petTypeName={petTypeName}
            feeding={feeding}
          />
        </Suspense>

        {/* ─── Accessories ─── */}
        {equippedAccessories.map((acc, i) => (
          <Pet3DAccessory
            key={i}
            position={acc.position}
            category={acc.category || "hat"}
            name={acc.name || ""}
            petPosition={targetPos}
            petScale={petScale}
          />
        ))}

        {/* ─── Camera ─── */}
        <CameraFollower targetPos={targetPos} />

        {/* ─── Post Processing ─── */}
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.9}
            luminanceSmoothing={0.4}
            intensity={0.3}
          />
          <Vignette eskil={false} offset={0.15} darkness={0.4} />
        </EffectComposer>
      </Canvas>

      {/* ─── Speech bubble ─── */}
      <AnimatePresence>
        {emotion && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            className="absolute z-20 bg-card border-2 border-border rounded-2xl px-3 py-2 shadow-md"
            style={{ top: "8%", left: "50%", transform: "translateX(-50%)", maxWidth: "180px" }}
          >
            <p className="text-xs font-bold text-foreground whitespace-nowrap">
              {emotion.emoji} {emotion.text}
            </p>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-r-2 border-b-2 border-border rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Feeding particles ─── */}
      <AnimatePresence>
        {feeding &&
          [...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute z-30 text-lg pointer-events-none"
              initial={{ top: "50%", left: "50%", opacity: 0, scale: 0 }}
              animate={{
                top: `${10 + Math.random() * 40}%`,
                left: `${15 + Math.random() * 70}%`,
                opacity: [0, 1, 0],
                scale: [0, 1.2, 0],
                rotate: [0, Math.random() * 360],
              }}
              transition={{ duration: 1.2, delay: 0.3 + i * 0.08, ease: "easeOut" }}
            >
              {["✨", "💕", "⭐", "🎉", "💖", "😋", "🌟", "💫"][i]}
            </motion.div>
          ))}
      </AnimatePresence>

      {/* ─── Action indicator ─── */}
      <div className="absolute top-2 left-3 z-10">
        {petAction === "sleeping" && !feeding && (
          <motion.span className="text-lg" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>💤</motion.span>
        )}
        {petAction === "walking" && !emotion && (
          <motion.span className="text-lg" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>🐾</motion.span>
        )}
      </div>

      <div className="absolute bottom-2 right-3 text-[10px] font-semibold text-white/60 pointer-events-none z-10">
        👆 터치해서 쓰다듬기
      </div>
    </div>
  );
}
