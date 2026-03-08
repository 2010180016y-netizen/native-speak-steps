import { useRef, useMemo, useState, useEffect, Suspense, Component, ReactNode } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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

// Error boundary
class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function Room() {
  const floorTex = useLoader(THREE.TextureLoader, roomFloorImg);
  const wallTex = useLoader(THREE.TextureLoader, roomWallImg);

  useMemo(() => {
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(2, 1);
  }, [floorTex, wallTex]);

  const s = 8, h = 5;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[s, s]} />
        <meshStandardMaterial map={floorTex} />
      </mesh>
      <mesh position={[0, h / 2, -s / 2]} receiveShadow>
        <planeGeometry args={[s, h]} />
        <meshStandardMaterial map={wallTex} />
      </mesh>
      <mesh position={[-s / 2, h / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[s, h]} />
        <meshStandardMaterial map={wallTex} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[s / 2, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[s, h]} />
        <meshStandardMaterial map={wallTex} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

function PetSprite({
  petImageUrl,
  petLevel,
  petAction,
  feeding,
  onTap,
}: Pick<Pet3DRoomProps, "petImageUrl" | "petLevel" | "petAction" | "feeding" | "onTap">) {
  const meshRef = useRef<THREE.Group>(null);
  const [targetPos, setTargetPos] = useState(new THREE.Vector3(0, 0, 0));
  const currentPos = useRef(new THREE.Vector3(0, 0, 0));
  const [facingRight, setFacingRight] = useState(true);

  const petTexture = useLoader(THREE.TextureLoader, petImageUrl || "/placeholder.svg");
  const petSize = 1.2 + (petLevel - 1) * 0.03;

  useEffect(() => {
    if (feeding) return;
    const wander = () => {
      if (petAction === "walking") {
        const nx = (Math.random() - 0.5) * 5;
        const nz = (Math.random() - 0.5) * 5;
        setFacingRight(nx > currentPos.current.x);
        setTargetPos(new THREE.Vector3(nx, 0, nz));
      }
    };
    const id = setInterval(wander, 3000 + Math.random() * 2000);
    return () => clearInterval(id);
  }, [petAction, feeding]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const speed = petAction === "walking" ? 1.2 : 0.5;
    currentPos.current.lerp(targetPos, delta * speed);
    meshRef.current.position.x = currentPos.current.x;
    meshRef.current.position.z = currentPos.current.z;

    const t = Date.now() * 0.001;
    if (petAction === "walking") {
      meshRef.current.position.y = petSize / 2 + Math.abs(Math.sin(t * 4)) * 0.15;
    } else if (petAction === "sleeping") {
      meshRef.current.position.y = petSize / 2 + Math.sin(t * 1.5) * 0.05;
    } else if (petAction === "playing") {
      meshRef.current.position.y = petSize / 2 + Math.abs(Math.sin(t * 6)) * 0.25;
    } else if (feeding) {
      meshRef.current.position.y = petSize / 2 + Math.sin(t * 8) * 0.1;
      meshRef.current.rotation.z = Math.sin(t * 6) * 0.1;
    } else {
      meshRef.current.position.y = petSize / 2 + Math.sin(t * 2) * 0.06;
      meshRef.current.rotation.z = 0;
    }
  });

  return (
    <group ref={meshRef} position={[0, petSize / 2, 0]} onClick={(e) => { e.stopPropagation(); onTap(); }}>
      {/* Pet billboard - always faces camera */}
      <mesh scale={[facingRight ? petSize : -petSize, petSize, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={petTexture} transparent alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Ground shadow */}
      <mesh position={[0, -petSize / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[petSize * 0.4, 32]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 5, 6);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

function Scene(props: Pet3DRoomProps) {
  return (
    <>
      <CameraSetup />
      <color attach="background" args={["#2d2418"]} />
      <fog attach="fog" args={["#2d2418", 8, 16]} />
      <ambientLight intensity={0.4} color="#ffeedd" />
      <directionalLight position={[3, 6, 3]} intensity={1.2} color="#fff5e0" castShadow />
      <pointLight position={[-3, 3, 2]} intensity={0.5} color="#ffcc88" />
      <pointLight position={[2, 2, -2]} intensity={0.3} color="#aaddff" />

      <Suspense fallback={null}>
        <Room />
        <PetSprite
          petImageUrl={props.petImageUrl}
          petLevel={props.petLevel}
          petAction={props.petAction}
          feeding={props.feeding}
          onTap={props.onTap}
        />
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
    </>
  );
}

export default function Pet3DRoom(props: Pet3DRoomProps) {
  if (!props.petImageUrl) return null;

  const fallback = (
    <div
      className="w-full rounded-2xl overflow-hidden border-2 border-border flex items-center justify-center"
      style={{ height: 320, background: "hsl(var(--muted))" }}
    >
      <p className="text-sm text-muted-foreground font-semibold">3D 로딩 실패 — 새로고침해 주세요</p>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback}>
      <div
        className="w-full rounded-2xl overflow-hidden border-2 border-border shadow-lg relative"
        style={{ height: 320, background: "#1a1510" }}
      >
        <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: false }}>
          <Scene {...props} />
        </Canvas>
        <div className="absolute bottom-2 right-3 text-[10px] font-semibold text-white/40 pointer-events-none">
          👆 터치해서 쓰다듬기 · 🔄 드래그로 시점 변경
        </div>
      </div>
    </ErrorBoundary>
  );
}
