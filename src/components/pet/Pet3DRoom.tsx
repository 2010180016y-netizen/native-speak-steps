import { useRef, useMemo, useState, useEffect, useCallback, Suspense } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { OrbitControls, Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import roomFloorImg from "@/assets/room-floor.jpg";
import roomWallImg from "@/assets/room-wall.jpg";

type PetAction = "idle" | "walking" | "sleeping" | "playing" | "eating";

type Pet3DRoomProps = {
  petImageUrl: string | null;
  petName: string;
  petLevel: number;
  species: string;
  equippedAccessories: { emoji: string; position: string }[];
  emotion: { emoji: string; text: string } | null;
  petAction: PetAction;
  feeding: boolean;
  onTap: () => void;
};

// Room environment with photorealistic textures
function Room() {
  const floorTex = useLoader(THREE.TextureLoader, roomFloorImg);
  const wallTex = useLoader(THREE.TextureLoader, roomWallImg);

  // Configure textures
  useMemo(() => {
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(2, 1);
  }, [floorTex, wallTex]);

  const roomSize = 8;
  const wallHeight = 5;

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[roomSize, roomSize]} />
        <meshStandardMaterial map={floorTex} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, wallHeight / 2, -roomSize / 2]} receiveShadow>
        <planeGeometry args={[roomSize, wallHeight]} />
        <meshStandardMaterial map={wallTex} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-roomSize / 2, wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[roomSize, wallHeight]} />
        <meshStandardMaterial map={wallTex} side={THREE.FrontSide} />
      </mesh>

      {/* Right wall */}
      <mesh position={[roomSize / 2, wallHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[roomSize, wallHeight]} />
        <meshStandardMaterial map={wallTex} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

// Animated pet sprite that walks around the room
function PetSprite({
  petImageUrl,
  petLevel,
  species,
  equippedAccessories,
  emotion,
  petAction,
  feeding,
  onTap,
}: Omit<Pet3DRoomProps, "petName">) {
  const meshRef = useRef<THREE.Group>(null);
  const spriteRef = useRef<THREE.Mesh>(null);
  const [targetPos, setTargetPos] = useState(new THREE.Vector3(0, 0, 0));
  const [currentPos] = useState(new THREE.Vector3(0, 0, 0));
  const [facingRight, setFacingRight] = useState(true);

  const petTexture = useLoader(THREE.TextureLoader, petImageUrl || "");

  // Pet size based on level
  const petSize = 1.2 + (petLevel - 1) * 0.03;

  // Wander logic
  useEffect(() => {
    if (feeding) return;

    const wander = () => {
      if (petAction === "walking") {
        const nx = (Math.random() - 0.5) * 5;
        const nz = (Math.random() - 0.5) * 5;
        setFacingRight(nx > currentPos.x);
        setTargetPos(new THREE.Vector3(nx, 0, nz));
      }
    };

    const interval = setInterval(wander, 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [petAction, feeding]);

  // Animation frame
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Smooth movement toward target
    const speed = petAction === "walking" ? 1.2 : 0.5;
    currentPos.lerp(targetPos, delta * speed);
    meshRef.current.position.x = currentPos.x;
    meshRef.current.position.z = currentPos.z;

    // Bobbing animation
    const time = Date.now() * 0.001;
    if (petAction === "walking") {
      meshRef.current.position.y = petSize / 2 + Math.abs(Math.sin(time * 4)) * 0.15;
    } else if (petAction === "sleeping") {
      meshRef.current.position.y = petSize / 2 + Math.sin(time * 1.5) * 0.05;
    } else if (petAction === "playing") {
      meshRef.current.position.y = petSize / 2 + Math.abs(Math.sin(time * 6)) * 0.25;
    } else if (feeding) {
      meshRef.current.position.y = petSize / 2 + Math.sin(time * 8) * 0.1;
      meshRef.current.rotation.z = Math.sin(time * 6) * 0.1;
    } else {
      // Idle breathing
      meshRef.current.position.y = petSize / 2 + Math.sin(time * 2) * 0.06;
    }

    // Face direction
    if (spriteRef.current) {
      spriteRef.current.scale.x = facingRight ? petSize : -petSize;
    }
  });

  return (
    <group ref={meshRef} position={[0, petSize / 2, 0]} onClick={(e) => { e.stopPropagation(); onTap(); }}>
      {/* Pet image as a billboard plane */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh ref={spriteRef}>
          <planeGeometry args={[petSize, petSize]} />
          <meshStandardMaterial
            map={petTexture}
            transparent
            alphaTest={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Shadow on ground */}
        <mesh position={[0, -petSize / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[petSize * 0.4, 32]} />
          <meshStandardMaterial color="#000000" transparent opacity={0.15} />
        </mesh>
      </Billboard>

      {/* Accessory overlays */}
      {equippedAccessories.map((acc, i) => {
        const yOffset =
          acc.position === "top" ? petSize * 0.55 :
          acc.position === "face" ? petSize * 0.15 :
          acc.position === "neck" ? -petSize * 0.2 :
          petSize * 0.5;

        return (
          <Billboard key={i}>
            <Text
              fontSize={petSize * 0.3}
              position={[
                acc.position === "back" ? petSize * 0.3 : 0,
                yOffset,
                0.1
              ]}
              anchorX="center"
              anchorY="middle"
            >
              {acc.emoji}
            </Text>
          </Billboard>
        );
      })}

      {/* Speech bubble */}
      {emotion && (
        <Billboard>
          <group position={[0, petSize * 0.7, 0]}>
            {/* Bubble background */}
            <mesh>
              <planeGeometry args={[2.2, 0.6]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.95} />
            </mesh>
            <Text
              fontSize={0.22}
              color="#333333"
              anchorX="center"
              anchorY="middle"
              position={[0, 0, 0.01]}
            >
              {emotion.emoji} {emotion.text}
            </Text>
          </group>
        </Billboard>
      )}

      {/* Action indicators */}
      {petAction === "sleeping" && !feeding && (
        <Billboard>
          <Text
            fontSize={0.4}
            position={[petSize * 0.4, petSize * 0.4, 0]}
            anchorX="center"
            anchorY="middle"
          >
            💤
          </Text>
        </Billboard>
      )}

      {/* Feeding particles */}
      {feeding && <FeedingParticles petSize={petSize} />}
    </group>
  );
}

function FeedingParticles({ petSize }: { petSize: number }) {
  const particlesRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!particlesRef.current) return;
    particlesRef.current.children.forEach((child, i) => {
      child.position.y += 0.02;
      child.position.x += Math.sin(Date.now() * 0.003 + i) * 0.01;
      (child as any).material && ((child as any).material.opacity = Math.max(0, 1 - child.position.y / 3));
    });
  });

  const emojis = ["✨", "💕", "⭐", "🎉", "💖", "😋", "🌟", "💫"];

  return (
    <group ref={particlesRef}>
      {emojis.map((emoji, i) => (
        <Billboard key={i}>
          <Text
            fontSize={0.25}
            position={[
              (Math.random() - 0.5) * petSize,
              Math.random() * petSize * 0.5,
              (Math.random() - 0.5) * 0.5,
            ]}
            anchorX="center"
            anchorY="middle"
          >
            {emoji}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}

// Camera setup
function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 5, 6);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

// Loading fallback
function LoadingFallback() {
  return (
    <mesh position={[0, 1, 0]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#8b5cf6" wireframe />
    </mesh>
  );
}

export default function Pet3DRoom(props: Pet3DRoomProps) {
  if (!props.petImageUrl) return null;

  return (
    <div
      className="w-full rounded-2xl overflow-hidden border-2 border-border shadow-lg"
      style={{ height: 320, background: "#1a1510" }}
    >
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: false }}>
        <CameraSetup />
        <color attach="background" args={["#2d2418"]} />
        <fog attach="fog" args={["#2d2418", 8, 16]} />

        {/* Lighting */}
        <ambientLight intensity={0.4} color="#ffeedd" />
        <directionalLight
          position={[3, 6, 3]}
          intensity={1.2}
          color="#fff5e0"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-3, 3, 2]} intensity={0.5} color="#ffcc88" />
        <pointLight position={[2, 2, -2]} intensity={0.3} color="#aaddff" />

        <Suspense fallback={<LoadingFallback />}>
          <Room />
          <PetSprite {...props} />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.5}
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
          target={[0, 0.5, 0]}
        />
      </Canvas>

      {/* Tap hint overlay */}
      <div className="absolute bottom-2 right-3 text-[10px] font-semibold text-white/40 pointer-events-none">
        👆 터치해서 쓰다듬기 · 🔄 드래그로 시점 변경
      </div>
    </div>
  );
}
