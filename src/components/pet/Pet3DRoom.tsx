import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

export default function Pet3DRoom({
  petImageUrl, petName, petLevel, equippedAccessories, emotion, petAction, feeding, onTap,
}: Pet3DRoomProps) {
  const [pos, setPos] = useState({ x: 50, y: 62 });
  const [facingRight, setFacingRight] = useState(true);
  const petSize = Math.min(100 + (petLevel - 1) * 2.5, 160);

  // Wander
  useEffect(() => {
    if (feeding) return;
    const id = setInterval(() => {
      if (petAction === "walking") {
        const nx = 15 + Math.random() * 70;
        const ny = 55 + Math.random() * 20;
        setFacingRight(nx > pos.x);
        setPos({ x: nx, y: ny });
      }
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(id);
  }, [petAction, feeding]);

  if (!petImageUrl) return null;

  return (
    <div
      className="w-full rounded-2xl overflow-hidden border-2 border-border shadow-lg cursor-pointer select-none relative"
      style={{ height: 320, perspective: "800px" }}
      onClick={onTap}
    >
      {/* CSS 3D Room */}
      <div className="absolute inset-0" style={{ transformStyle: "preserve-3d", transform: "rotateX(15deg) translateY(-10px)" }}>
        {/* Back wall */}
        <div
          className="absolute inset-x-0 top-0"
          style={{
            height: "60%",
            backgroundImage: `url(${roomWallImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            transform: "translateZ(-20px)",
            filter: "brightness(0.85)",
          }}
        />

        {/* Floor */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: "55%",
            backgroundImage: `url(${roomFloorImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            transform: "rotateX(25deg) translateZ(10px)",
            transformOrigin: "center top",
          }}
        />
      </div>

      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.15) 100%)",
      }} />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        boxShadow: "inset 0 0 60px rgba(0,0,0,0.3)",
        borderRadius: "inherit",
      }} />

      {/* Speech bubble */}
      <AnimatePresence>
        {emotion && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            className="absolute z-20 bg-card border-2 border-border rounded-2xl px-3 py-2 shadow-md"
            style={{
              left: `${pos.x}%`, top: `${pos.y - 24}%`,
              transform: "translate(-50%, -100%)", maxWidth: "160px",
            }}
          >
            <p className="text-xs font-bold text-foreground whitespace-nowrap">
              {emotion.emoji} {emotion.text}
            </p>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-r-2 border-b-2 border-border rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pet character */}
      <motion.div
        className="absolute z-10"
        animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        transition={{ duration: petAction === "walking" ? 2 : 0.3, ease: "easeInOut" }}
        style={{ transform: "translate(-50%, -50%)" }}
      >
        {/* Action indicator */}
        {petAction === "sleeping" && !feeding && (
          <motion.div className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm"
            animate={{ y: [0, -3, 0], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}>💤</motion.div>
        )}
        {petAction === "walking" && !emotion && (
          <motion.div className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm"
            animate={{ y: [0, -3, 0], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}>🐾</motion.div>
        )}

        <motion.div
          animate={
            feeding ? { scale: [1, 1.1, 0.95, 1.05, 1], rotate: [0, -5, 5, -3, 0], y: [0, -5, 0, -3, 0] }
            : petAction === "sleeping" ? { y: [0, -2, 0], rotate: [0, 2, 0] }
            : petAction === "walking" ? { y: [0, -8, 0], rotate: [0, -2, 0, 2, 0] }
            : petAction === "playing" ? { y: [0, -12, 0], scale: [1, 1.05, 1] }
            : { y: [0, -6, 0] }
          }
          transition={
            feeding ? { duration: 1, ease: "easeInOut", repeat: 1 }
            : petAction === "sleeping" ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
            : { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }
          style={{ width: petSize, height: petSize, transform: `scaleX(${facingRight ? 1 : -1})` }}
        >
          <img
            src={petImageUrl}
            alt={petName}
            className="w-full h-full rounded-3xl object-cover shadow-xl border-2 border-border/50"
            draggable={false}
          />

          {/* Shadow */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-3 rounded-full bg-black/20 blur-sm" />

          {/* Accessories */}
          {equippedAccessories.map((acc, i) => (
            <div key={i} className="absolute pointer-events-none select-none"
              style={{
                fontSize: petSize * 0.25,
                ...(acc.position === "top" ? { top: -4, left: "50%", transform: "translateX(-50%)" } : {}),
                ...(acc.position === "face" ? { top: "28%", left: "50%", transform: "translateX(-50%)" } : {}),
                ...(acc.position === "neck" ? { bottom: 4, left: "50%", transform: "translateX(-50%)" } : {}),
                ...(acc.position === "back" ? { top: -2, right: -6 } : {}),
              }}>
              {acc.emoji}
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Feeding particles */}
      <AnimatePresence>
        {feeding && [...Array(8)].map((_, i) => (
          <motion.div key={i} className="absolute z-30 text-lg pointer-events-none"
            initial={{ top: "50%", left: "50%", opacity: 0, scale: 0 }}
            animate={{ top: `${10 + Math.random() * 40}%`, left: `${15 + Math.random() * 70}%`, opacity: [0, 1, 0], scale: [0, 1.2, 0], rotate: [0, Math.random() * 360] }}
            transition={{ duration: 1.2, delay: 0.3 + i * 0.08, ease: "easeOut" }}>
            {["✨", "💕", "⭐", "🎉", "💖", "😋", "🌟", "💫"][i]}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Hint */}
      <div className="absolute bottom-2 right-3 text-[10px] font-semibold text-white/40 pointer-events-none">
        👆 터치해서 쓰다듬기
      </div>
    </div>
  );
}
