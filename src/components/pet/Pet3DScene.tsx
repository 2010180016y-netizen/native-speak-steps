import { Suspense, useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import PetModel from "./PetModel";
import Pet3DAccessory from "./Pet3DAccessory";
import * as THREE from "three";

type PetAction = "idle" | "walking" | "sleeping" | "playing" | "eating";

type Pet3DSceneProps = {
  petName: string;
  petLevel: number;
  species: string;
  equippedAccessories: { emoji: string; position: string; name?: string; category?: string }[];
  emotion: { emoji: string; text: string } | null;
  petAction: PetAction;
  feeding: boolean;
  onTap: () => void;
};

function Room() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#c4956a" roughness={0.8} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 2.5, -5]} receiveShadow>
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#f5e6d3" roughness={0.9} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-5, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#ede0d4" roughness={0.9} />
      </mesh>

      {/* Right wall */}
      <mesh position={[5, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#ede0d4" roughness={0.9} />
      </mesh>

      {/* Pet bed */}
      <group position={[-2.5, 0, -2]}>
        <mesh position={[0, 0.15, 0]} castShadow>
          <cylinderGeometry args={[0.8, 0.9, 0.3, 16]} />
          <meshStandardMaterial color="#8b4513" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.6, 0.65, 0.15, 16]} />
          <meshStandardMaterial color="#d2691e" roughness={0.9} />
        </mesh>
      </group>

      {/* Food bowl */}
      <group position={[2.5, 0, -3]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.25, 0.2, 16]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.05, 16]} />
          <meshStandardMaterial color="#8B4513" roughness={0.9} />
        </mesh>
      </group>

      {/* Water bowl */}
      <group position={[3.2, 0, -3]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.25, 0.2, 0.2, 16]} />
          <meshStandardMaterial color="#4682b4" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.03, 16]} />
          <meshStandardMaterial color="#87ceeb" transparent opacity={0.7} roughness={0.1} />
        </mesh>
      </group>

      {/* Toy ball */}
      <mesh position={[1.5, 0.2, 1]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#ff4444" roughness={0.5} />
      </mesh>

      {/* Toy bone */}
      <group position={[-1, 0.08, 2]} rotation={[0, 0.5, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
          <meshStandardMaterial color="#f5f5dc" roughness={0.8} />
        </mesh>
        <mesh position={[-0.2, 0, 0]} castShadow>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="#f5f5dc" roughness={0.8} />
        </mesh>
        <mesh position={[0.2, 0, 0]} castShadow>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="#f5f5dc" roughness={0.8} />
        </mesh>
      </group>

      {/* Window */}
      <group position={[0, 3, -4.95]}>
        <mesh>
          <planeGeometry args={[2, 1.5]} />
          <meshStandardMaterial color="#87ceeb" emissive="#87ceeb" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[2.1, 0.05]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        <mesh position={[0, 0, 0.01]} rotation={[0, 0, Math.PI / 2]}>
          <planeGeometry args={[1.6, 0.05]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      </group>

      {/* Baseboard */}
      <mesh position={[0, 0.1, -4.95]}>
        <boxGeometry args={[10, 0.2, 0.05]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
    </group>
  );
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
  equippedAccessories,
  emotion,
  petAction,
  feeding,
  onTap,
}: Pet3DSceneProps) {
  const [targetPos, setTargetPos] = useState<[number, number, number]>([0, 0, 0]);
  const petScale = Math.min(0.8 + (petLevel - 1) * 0.04, 1.8);

  // Wander logic
  useEffect(() => {
    if (feeding) return;
    const wander = () => {
      if (petAction === "walking") {
        setTargetPos([-3 + Math.random() * 6, 0, -3 + Math.random() * 6]);
      } else if (petAction === "sleeping") {
        setTargetPos([-2.5, 0, -2]);
      } else if (petAction === "eating") {
        setTargetPos([2.5, 0, -3]);
      }
    };
    const id = setInterval(wander, 3000 + Math.random() * 2000);
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
        gl={{ antialias: true, alpha: false }}
        style={{ background: "linear-gradient(180deg, #87CEEB 0%, #E0F0FF 100%)" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[3, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-2, 3, -2]} intensity={0.3} color="#ffeedd" />

        <Room />

        <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={10} blur={2} far={5} />

        <Suspense fallback={<LoadingFallback />}>
          <PetModel
            action={petAction}
            position={[0, 0, 0]}
            targetPosition={targetPos}
            scale={petScale}
            species={species}
            feeding={feeding}
          />
        </Suspense>

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

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.5}
          minAzimuthAngle={-Math.PI / 6}
          maxAzimuthAngle={Math.PI / 6}
        />
      </Canvas>

      {/* Speech bubble */}
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

      {/* Feeding particles */}
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

      {/* Action indicator */}
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
