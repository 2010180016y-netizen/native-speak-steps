import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Animated dust particles floating in sunlight */
function DustParticles() {
  const ref = useRef<THREE.Points>(null!);
  const count = 40;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 1] = 0.5 + Math.random() * 3.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      (pos.array as Float32Array)[i3] += Math.sin(t * 0.3 + i) * 0.001;
      (pos.array as Float32Array)[i3 + 1] += Math.sin(t * 0.2 + i * 0.7) * 0.0008;
      (pos.array as Float32Array)[i3 + 2] += Math.cos(t * 0.25 + i * 0.5) * 0.001;
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#fffbe6" transparent opacity={0.35} sizeAttenuation />
    </points>
  );
}

function Rug({ position }: { position: [number, number, number] }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0.2]} position={position} receiveShadow>
      <circleGeometry args={[1.4, 32]} />
      <meshStandardMaterial color="#a0522d" roughness={1} />
    </mesh>
  );
}

function Bookshelf({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.2, 1.8, 0.35]} />
        <meshStandardMaterial color="#6b4226" roughness={0.7} />
      </mesh>
      {[0.5, 0, -0.5].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[1.1, 0.04, 0.33]} />
          <meshStandardMaterial color="#8b5e3c" roughness={0.8} />
        </mesh>
      ))}
      {[
        { pos: [-0.3, 0.7, 0] as const, color: "#c0392b", h: 0.35 },
        { pos: [-0.1, 0.68, 0] as const, color: "#2980b9", h: 0.3 },
        { pos: [0.1, 0.72, 0] as const, color: "#27ae60", h: 0.38 },
        { pos: [0.3, 0.66, 0] as const, color: "#f39c12", h: 0.28 },
        { pos: [-0.2, 0.2, 0] as const, color: "#8e44ad", h: 0.32 },
        { pos: [0.05, 0.18, 0] as const, color: "#e74c3c", h: 0.26 },
        { pos: [0.25, 0.22, 0] as const, color: "#1abc9c", h: 0.36 },
      ].map((book, i) => (
        <mesh key={`b${i}`} position={[...book.pos]} castShadow>
          <boxGeometry args={[0.12, book.h, 0.22]} />
          <meshStandardMaterial color={book.color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function PlantPot({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.1, 0.3, 12]} />
        <meshStandardMaterial color="#c0392b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.02, 12]} />
        <meshStandardMaterial color="#3e2723" roughness={1} />
      </mesh>
      {[0, 1.2, 2.4, 3.6, 5].map((angle, i) => (
        <mesh key={i} position={[Math.sin(angle) * 0.08, 0.45 + i * 0.03, Math.cos(angle) * 0.08]} rotation={[0.3, angle, 0.2]} castShadow>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshStandardMaterial color="#2ecc71" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function WallClock({ position }: { position: [number, number, number] }) {
  const handRef = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (handRef.current) handRef.current.rotation.z = -clock.getElapsedTime() * 0.5;
  });

  return (
    <group position={position}>
      <mesh>
        <circleGeometry args={[0.35, 32]} />
        <meshStandardMaterial color="#faf0e6" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <ringGeometry args={[0.33, 0.38, 32]} />
        <meshStandardMaterial color="#8B4513" roughness={0.6} />
      </mesh>
      <mesh ref={handRef} position={[0, 0, 0.01]}>
        <boxGeometry args={[0.02, 0.2, 0.01]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.28, Math.cos(a) * 0.28, 0.01]}>
            <circleGeometry args={[0.015, 8]} />
            <meshStandardMaterial color="#555" />
          </mesh>
        );
      })}
    </group>
  );
}

function PictureFrame({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.7, 0.5, 0.04]} />
        <meshStandardMaterial color="#6b4226" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[0.58, 0.38]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  );
}

export default function Room() {
  return (
    <group>
      {/* ─── Floor ─── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#b8845a" roughness={0.75} metalness={0.05} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={`plank-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-3.5 + i * 1, 0, 0]}>
          <planeGeometry args={[0.02, 10]} />
          <meshStandardMaterial color="#a07040" roughness={0.9} transparent opacity={0.3} />
        </mesh>
      ))}

      {/* ─── Walls ─── */}
      <mesh position={[0, 2.5, -5]} receiveShadow>
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#f0e0cc" roughness={0.85} />
      </mesh>
      <mesh position={[-5, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#e8d5c0" roughness={0.85} />
      </mesh>
      <mesh position={[5, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#e8d5c0" roughness={0.85} />
      </mesh>

      {/* ─── Baseboards ─── */}
      {[
        { pos: [0, 0.08, -4.97] as [number, number, number], rot: [0, 0, 0] as [number, number, number] },
        { pos: [-4.97, 0.08, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number] },
        { pos: [4.97, 0.08, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number] },
      ].map((b, i) => (
        <mesh key={`bb${i}`} position={b.pos} rotation={b.rot}>
          <boxGeometry args={[10, 0.16, 0.06]} />
          <meshStandardMaterial color="#6b4226" roughness={0.7} />
        </mesh>
      ))}

      {/* ─── Rug ─── */}
      <Rug position={[-2.5, 0.01, -2]} />

      {/* ─── Pet bed ─── */}
      <group position={[-2.5, 0, -2]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.85, 0.95, 0.24, 24]} />
          <meshStandardMaterial color="#5c3317" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.65, 0.7, 0.12, 24]} />
          <meshStandardMaterial color="#c97b4b" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.28, 0]} castShadow>
          <sphereGeometry args={[0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#d4a06a" roughness={1} />
        </mesh>
      </group>

      {/* ─── Bowls ─── */}
      <group position={[2.5, 0, -3]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.24, 0.18, 20]} />
          <meshStandardMaterial color="#b0b0b0" metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 0.04, 20]} />
          <meshStandardMaterial color="#7B3F00" roughness={0.9} />
        </mesh>
      </group>
      <group position={[3.2, 0, -3]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.2, 0.18, 20]} />
          <meshStandardMaterial color="#3a7bbf" metalness={0.7} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.03, 20]} />
          <meshStandardMaterial color="#7ec8e3" transparent opacity={0.6} roughness={0.05} />
        </mesh>
      </group>

      {/* ─── Toys ─── */}
      <mesh position={[1.5, 0.18, 1]} castShadow>
        <sphereGeometry args={[0.18, 20, 20]} />
        <meshStandardMaterial color="#e74c3c" roughness={0.4} metalness={0.1} />
      </mesh>
      <group position={[-1, 0.06, 2]} rotation={[0, 0.5, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.05, 0.4, 4, 8]} />
          <meshStandardMaterial color="#f5ecd0" roughness={0.9} />
        </mesh>
        <mesh position={[-0.25, 0, 0]} castShadow>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshStandardMaterial color="#f5ecd0" roughness={0.9} />
        </mesh>
        <mesh position={[0.25, 0, 0]} castShadow>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshStandardMaterial color="#f5ecd0" roughness={0.9} />
        </mesh>
      </group>
      <mesh position={[0.5, 0.1, 2.5]} castShadow>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color="#f1c40f" roughness={0.5} />
      </mesh>

      {/* ─── Window with curtains ─── */}
      <group position={[0, 3, -4.94]}>
        <mesh>
          <planeGeometry args={[2.2, 1.8]} />
          <meshStandardMaterial color="#a8d8ea" emissive="#a8d8ea" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[2.3, 0.06]} />
          <meshStandardMaterial color="#f5f0e8" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.01]} rotation={[0, 0, Math.PI / 2]}>
          <planeGeometry args={[1.9, 0.06]} />
          <meshStandardMaterial color="#f5f0e8" roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.95, 0.15]}>
          <boxGeometry args={[2.5, 0.06, 0.3]} />
          <meshStandardMaterial color="#f5f0e8" roughness={0.5} />
        </mesh>
        <mesh position={[-1.3, 0, 0.02]}>
          <planeGeometry args={[0.5, 2.2]} />
          <meshStandardMaterial color="#d4a76a" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[1.3, 0, 0.02]}>
          <planeGeometry args={[0.5, 2.2]} />
          <meshStandardMaterial color="#d4a76a" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ─── Furniture & Decor ─── */}
      <Bookshelf position={[-4.75, 0.9, -3]} />
      <PlantPot position={[0.6, 2.05, -4.7]} />
      <WallClock position={[2, 3.2, -4.93]} />
      <PictureFrame position={[-2, 3.3, -4.93]} color="#87ceeb" />
      <PictureFrame position={[4.93, 2.8, -2]} color="#f4a460" />

      {/* ─── Dust particles ─── */}
      <DustParticles />
    </group>
  );
}
