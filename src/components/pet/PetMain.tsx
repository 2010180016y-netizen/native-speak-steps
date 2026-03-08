import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { UserPet, PetItem, UserPoints } from "@/hooks/usePet";

type Props = {
  activePet: UserPet | null;
  items: PetItem[];
  points: UserPoints | null;
  feedPet: (itemId: string) => Promise<boolean>;
  loading: boolean;
};

type FeedingState = {
  active: boolean;
  emoji: string;
  itemName: string;
};

type PetAction = "idle" | "walking" | "sleeping" | "playing" | "eating";
type Emotion = { emoji: string; text: string } | null;

// Growth stage titles
const GROWTH_STAGES: { maxLevel: number; label: string; emoji: string }[] = [
  { maxLevel: 3, label: "아기", emoji: "🍼" },
  { maxLevel: 7, label: "꼬마", emoji: "🌱" },
  { maxLevel: 12, label: "청소년", emoji: "⭐" },
  { maxLevel: 18, label: "성인", emoji: "💪" },
  { maxLevel: 24, label: "베테랑", emoji: "🏅" },
  { maxLevel: 30, label: "전설", emoji: "👑" },
];

const getGrowthStage = (level: number) => {
  return GROWTH_STAGES.find((s) => level <= s.maxLevel) || GROWTH_STAGES[GROWTH_STAGES.length - 1];
};

// Mood speech bubbles
const IDLE_BUBBLES = [
  { emoji: "😊", text: "오늘도 열심히 공부하자!" },
  { emoji: "💤", text: "졸려..." },
  { emoji: "🤔", text: "뭐 하고 놀까~" },
  { emoji: "😋", text: "배고파..." },
  { emoji: "💕", text: "같이 있어서 좋아!" },
  { emoji: "🎵", text: "랄라라~♪" },
  { emoji: "📚", text: "오늘 공부는 했어?" },
  { emoji: "✨", text: "나 많이 컸지?" },
];

const HAPPY_BUBBLES = [
  { emoji: "😆", text: "간식 맛있다!" },
  { emoji: "🥰", text: "최고야!" },
  { emoji: "🎉", text: "야호!" },
];

const PET_REACTIONS = [
  { emoji: "😍", text: "좋아좋아~!" },
  { emoji: "🥹", text: "더 만져줘!" },
  { emoji: "💖", text: "행복해!" },
  { emoji: "☺️", text: "헤헤~" },
];

// Room furniture elements
const ROOM_ITEMS = [
  { emoji: "🛋️", x: "8%", y: "65%", size: "text-2xl" },
  { emoji: "🪴", x: "85%", y: "55%", size: "text-xl" },
  { emoji: "📚", x: "12%", y: "35%", size: "text-lg" },
  { emoji: "🖼️", x: "50%", y: "18%", size: "text-xl" },
  { emoji: "💡", x: "80%", y: "25%", size: "text-lg" },
];

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊", proud: "🥰", lonely: "🥺", sleepy: "😴", excited: "🤩", neutral: "📝",
};

const PetMain = ({ activePet, items, points, feedPet, loading }: Props) => {
  const { user } = useAuth();
  const [feeding, setFeeding] = useState<FeedingState>({ active: false, emoji: "", itemName: "" });
  const [petAction, setPetAction] = useState<PetAction>("idle");
  const [emotion, setEmotion] = useState<Emotion>(null);
  const [petPosition, setPetPosition] = useState({ x: 50, y: 60 });
  const [facingRight, setFacingRight] = useState(true);
  const [happiness, setHappiness] = useState(75);
  const [hunger, setHunger] = useState(60);
  const [tapCount, setTapCount] = useState(0);
  const walkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Diary state
  const [diary, setDiary] = useState<{ content: string; mood: string; diary_date: string } | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryHistory, setDiaryHistory] = useState<{ content: string; mood: string; diary_date: string }[]>([]);
  const [showDiaryHistory, setShowDiaryHistory] = useState(false);

  // Equipped accessories
  const [equippedAccessories, setEquippedAccessories] = useState<{ emoji: string; position: string }[]>([]);

  // Pet size based on level
  const petLevel = activePet?.level || 1;
  const petSize = Math.min(120 + (petLevel - 1) * 2.5, 180); // 120px to 180px

  // Simulate walking
  useEffect(() => {
    if (!activePet || feeding.active) return;

    const walk = () => {
      const actions: PetAction[] = ["idle", "idle", "walking", "walking", "sleeping", "playing"];
      const newAction = actions[Math.floor(Math.random() * actions.length)];
      setPetAction(newAction);

      if (newAction === "walking") {
        const newX = 15 + Math.random() * 70;
        const newY = 50 + Math.random() * 25;
        setFacingRight(newX > petPosition.x);
        setPetPosition({ x: newX, y: newY });
      }
    };

    walkTimerRef.current = setInterval(walk, 3000 + Math.random() * 2000);
    return () => { if (walkTimerRef.current) clearInterval(walkTimerRef.current); };
  }, [activePet, feeding.active]);

  // Random speech bubbles
  useEffect(() => {
    if (!activePet) return;

    const showBubble = () => {
      if (emotion || feeding.active) return;
      const bubbles = hunger < 30 
        ? [{ emoji: "😢", text: "배고파... 간식 줘!" }, { emoji: "😭", text: "밥 주세요..." }]
        : happiness < 30
        ? [{ emoji: "😔", text: "심심해..." }, { emoji: "🥺", text: "놀아줘..." }]
        : IDLE_BUBBLES;
      const bubble = bubbles[Math.floor(Math.random() * bubbles.length)];
      setEmotion(bubble);
      setTimeout(() => setEmotion(null), 3000);
    };

    emotionTimerRef.current = setTimeout(showBubble, 5000 + Math.random() * 8000);
    return () => { if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current); };
  }, [activePet, emotion, feeding.active, hunger, happiness]);

  // Hunger/happiness decay over time (simulated per session)
  useEffect(() => {
    const decay = setInterval(() => {
      setHunger((h) => Math.max(0, h - 1));
      setHappiness((h) => Math.max(0, h - 0.5));
    }, 30000); // decay every 30s
    return () => clearInterval(decay);
  }, []);

  // Fetch diary
  const fetchDiary = useCallback(async () => {
    if (!activePet || !user) return;
    setDiaryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pet-diary", {
        body: {
          petId: activePet.id,
          petName: activePet.name,
          species: activePet.pet_type?.species || "dog",
        },
      });
      if (!error && data?.diary) {
        setDiary(data.diary);
      }
    } catch (e) {
      console.error("Diary fetch error:", e);
    }
    setDiaryLoading(false);
  }, [activePet, user]);

  // Fetch diary history
  const fetchDiaryHistory = useCallback(async () => {
    if (!activePet || !user) return;
    const { data } = await supabase
      .from("pet_diaries")
      .select("content, mood, diary_date")
      .eq("pet_id", activePet.id)
      .order("diary_date", { ascending: false })
      .limit(7);
    if (data) setDiaryHistory(data);
  }, [activePet, user]);

  useEffect(() => {
    if (activePet && user) {
      fetchDiary();
      fetchDiaryHistory();
    }
  }, [activePet?.id, user]);

  // Fetch equipped accessories
  useEffect(() => {
    if (!activePet || !user) return;
    const fetchEquipped = async () => {
      const { data: userAcc } = await supabase
        .from("user_pet_accessories")
        .select("accessory_id")
        .eq("pet_id", activePet.id)
        .eq("is_equipped", true);
      if (!userAcc || userAcc.length === 0) { setEquippedAccessories([]); return; }
      const ids = userAcc.map((ua: any) => ua.accessory_id);
      const { data: accs } = await supabase
        .from("pet_accessories")
        .select("emoji, position")
        .in("id", ids);
      setEquippedAccessories((accs as { emoji: string; position: string }[]) || []);
    };
    fetchEquipped();
  }, [activePet?.id, user]);

  const handleTap = useCallback(() => {
    if (!activePet || feeding.active) return;
    setTapCount((c) => c + 1);
    setHappiness((h) => Math.min(100, h + 5));
    
    const reaction = PET_REACTIONS[Math.floor(Math.random() * PET_REACTIONS.length)];
    setEmotion(reaction);
    setPetAction("playing");
    
    setTimeout(() => {
      setEmotion(null);
      setPetAction("idle");
    }, 2000);
  }, [activePet, feeding.active]);

  const handleFeed = useCallback(async (item: PetItem) => {
    setFeeding({ active: true, emoji: item.emoji, itemName: item.name });
    setPetAction("eating");
    
    // Move pet to center for feeding
    setPetPosition({ x: 50, y: 60 });
    
    const success = await feedPet(item.id);
    if (success) {
      setHunger((h) => Math.min(100, h + 25));
      setHappiness((h) => Math.min(100, h + 10));
      
      const bubble = HAPPY_BUBBLES[Math.floor(Math.random() * HAPPY_BUBBLES.length)];
      setEmotion(bubble);
      await new Promise((r) => setTimeout(r, 1500));
      setEmotion(null);
    }
    setFeeding({ active: false, emoji: "", itemName: "" });
    setPetAction("idle");
  }, [feedPet]);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-16">
        <div className="animate-bounce text-5xl">🐾</div>
      </motion.div>
    );
  }

  if (!activePet) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
        <div className="text-5xl mb-4">🏠</div>
        <p className="font-bold text-foreground mb-1">아직 펫이 없어요!</p>
        <p className="text-sm text-muted-foreground">"입양" 탭에서 첫 번째 친구를 만나보세요</p>
      </motion.div>
    );
  }

  const expPercent = Math.min((activePet.experience / activePet.exp_to_next_level) * 100, 100);
  const quickSnacks = items.filter((i) => i.category === "snack").slice(0, 3);
  const stage = getGrowthStage(activePet.level);

  const getActionEmoji = () => {
    switch (petAction) {
      case "sleeping": return "💤";
      case "playing": return "⭐";
      case "walking": return "🐾";
      default: return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      {/* Room Scene */}
      <div 
        className="duo-card relative overflow-hidden mb-4 cursor-pointer select-none"
        style={{ height: 320, background: "linear-gradient(180deg, hsl(var(--muted)/0.3) 0%, hsl(var(--muted)/0.6) 60%, hsl(var(--muted)/0.9) 100%)" }}
        onClick={handleTap}
      >
        {/* Wall pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ 
          backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "20px 20px" 
        }} />

        {/* Floor line */}
        <div className="absolute bottom-[20%] left-0 right-0 h-[2px] bg-border/30" />
        <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-muted/50 rounded-b-2xl" />

        {/* Room furniture */}
        {ROOM_ITEMS.map((item, i) => (
          <div
            key={i}
            className={`absolute ${item.size} opacity-40 select-none`}
            style={{ left: item.x, top: item.y, transform: "translate(-50%, -50%)" }}
          >
            {item.emoji}
          </div>
        ))}

        {/* Speech bubble */}
        <AnimatePresence>
          {emotion && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.8 }}
              className="absolute z-20 bg-card border-2 border-border rounded-2xl px-3 py-2 shadow-md"
              style={{
                left: `${petPosition.x}%`,
                top: `${petPosition.y - 22}%`,
                transform: "translate(-50%, -100%)",
                maxWidth: "160px",
              }}
            >
              <p className="text-xs font-bold text-foreground whitespace-nowrap">
                {emotion.emoji} {emotion.text}
              </p>
              {/* Bubble tail */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-r-2 border-b-2 border-border rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feeding animation overlay */}
        <AnimatePresence>
          {feeding.active && (
            <>
              <motion.div
                className="absolute z-30 text-4xl"
                initial={{ bottom: 20, left: "50%", x: "-50%", opacity: 1, scale: 1.2 }}
                animate={{
                  bottom: [20, 100, 160],
                  scale: [1.2, 1.5, 0.3],
                  opacity: [1, 1, 0],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeIn" }}
              >
                {feeding.emoji}
              </motion.div>
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute z-30 text-lg pointer-events-none"
                  initial={{ top: "45%", left: "50%", opacity: 0, scale: 0 }}
                  animate={{
                    top: `${15 + Math.random() * 30}%`,
                    left: `${15 + Math.random() * 70}%`,
                    opacity: [0, 1, 0],
                    scale: [0, 1.2, 0],
                    rotate: [0, Math.random() * 360],
                  }}
                  transition={{ duration: 1.2, delay: 0.5 + i * 0.08, ease: "easeOut" }}
                >
                  {["✨", "💕", "⭐", "🎉", "💖", "😋", "🌟", "💫"][i]}
                </motion.div>
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Pet character */}
        <motion.div
          className="absolute z-10"
          animate={{
            left: `${petPosition.x}%`,
            top: `${petPosition.y}%`,
          }}
          transition={{ 
            duration: petAction === "walking" ? 2 : 0.3,
            ease: "easeInOut",
          }}
          style={{ transform: "translate(-50%, -50%)" }}
        >
          {/* Action indicator */}
          {getActionEmoji() && !emotion && (
            <motion.div
              className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm"
              animate={{ y: [0, -3, 0], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {getActionEmoji()}
            </motion.div>
          )}

          {/* Pet image */}
          <motion.div
            animate={
              feeding.active
                ? { scale: [1, 1.1, 0.95, 1.05, 1], rotate: [0, -5, 5, -3, 0], y: [0, -5, 0, -3, 0] }
                : petAction === "sleeping"
                ? { y: [0, -2, 0], rotate: [0, 2, 0] }
                : petAction === "walking"
                ? { y: [0, -6, 0], rotate: [0, -2, 0, 2, 0] }
                : petAction === "playing"
                ? { y: [0, -10, 0], scale: [1, 1.05, 1] }
                : { y: [0, -6, 0] }
            }
            transition={
              feeding.active
                ? { duration: 1, ease: "easeInOut", repeat: 1 }
                : petAction === "sleeping"
                ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                : { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }
            style={{ 
              transform: `scaleX(${facingRight ? 1 : -1})`,
              width: petSize,
              height: petSize,
            }}
          >
            {(activePet.image_url || activePet.pet_type?.base_image_url) ? (
              <img
                src={activePet.image_url || activePet.pet_type?.base_image_url || ""}
                alt={activePet.name}
                className="w-full h-full rounded-3xl object-cover shadow-lg border-2 border-border"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full rounded-3xl bg-muted flex items-center justify-center text-5xl">
                {activePet.pet_type?.species === "cat" ? "🐱" : "🐶"}
              </div>
            )}

            {/* Equipped accessories overlay */}
            {equippedAccessories.map((acc, i) => (
              <div
                key={i}
                className="absolute pointer-events-none select-none"
                style={{
                  fontSize: petSize * 0.25,
                  ...(acc.position === "top" ? { top: -4, left: "50%", transform: "translateX(-50%)" } : {}),
                  ...(acc.position === "face" ? { top: "28%", left: "50%", transform: "translateX(-50%)" } : {}),
                  ...(acc.position === "neck" ? { bottom: 4, left: "50%", transform: "translateX(-50%)" } : {}),
                  ...(acc.position === "back" ? { top: -2, right: -6 } : {}),
                }}
              >
                {acc.emoji}
              </div>
            ))

            {/* Eating animation */}
            <AnimatePresence>
              {feeding.active && (
                <motion.div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-2xl"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 1, 0], scale: [0, 1.3, 1, 0] }}
                  transition={{ duration: 1.5, delay: 0.3 }}
                >
                  😋
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sleeping zzz */}
            {petAction === "sleeping" && !feeding.active && (
              <motion.div
                className="absolute -top-2 -right-2 text-lg"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                💤
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        {/* Tap hint */}
        <div className="absolute bottom-2 right-3 text-[10px] font-semibold text-muted-foreground/50">
          👆 터치해서 쓰다듬기
        </div>
      </div>

      {/* Pet Info Card */}
      <div className="duo-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">{activePet.name}</h2>
            <p className="text-xs text-muted-foreground font-semibold">
              {activePet.pet_type?.name} · Lv.{activePet.level}
              <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold">
                {stage.emoji} {stage.label}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground font-bold">쓰다듬기</p>
            <p className="text-sm font-extrabold text-primary">{tapCount}회</p>
          </div>
        </div>

        {/* EXP bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-muted-foreground font-bold mb-1">
            <span>EXP</span>
            <span>{activePet.experience}/{activePet.exp_to_next_level}</span>
          </div>
          <div className="duo-progress-bar h-3">
            <motion.div
              className="h-full rounded-full bg-secondary"
              initial={{ width: 0 }}
              animate={{ width: `${expPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Status gauges */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold mb-1">
              <span className="text-muted-foreground">😊 행복도</span>
              <span className={happiness > 50 ? "text-primary" : happiness > 25 ? "text-yellow-500" : "text-destructive"}>
                {Math.round(happiness)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${happiness > 50 ? "bg-primary" : happiness > 25 ? "bg-yellow-500" : "bg-destructive"}`}
                animate={{ width: `${happiness}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold mb-1">
              <span className="text-muted-foreground">🍖 포만감</span>
              <span className={hunger > 50 ? "text-secondary" : hunger > 25 ? "text-yellow-500" : "text-destructive"}>
                {Math.round(hunger)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${hunger > 50 ? "bg-secondary" : hunger > 25 ? "bg-yellow-500" : "bg-destructive"}`}
                animate={{ width: `${hunger}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick feed */}
      <div className="duo-card">
        <h3 className="font-bold text-foreground mb-3">🍽️ 간식 주기</h3>
        {hunger < 30 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-destructive font-bold mb-2"
          >
            ⚠️ {activePet.name}이(가) 배고파해요! 간식을 주세요!
          </motion.p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {quickSnacks.map((item) => (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleFeed(item)}
              disabled={feeding.active || !points || points.balance < item.price}
              className="duo-card p-3 text-center cursor-pointer disabled:opacity-40 hover:border-primary transition-colors"
            >
              <div className="text-2xl mb-1">{item.emoji}</div>
              <div className="text-[10px] font-bold text-foreground truncate">{item.name}</div>
              <div className="text-[10px] text-muted-foreground font-semibold">{item.price}P · +{item.exp_reward}exp</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Pet Diary */}
      <div className="duo-card mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground">📔 {activePet.name}의 일기</h3>
          {diaryHistory.length > 1 && (
            <button
              onClick={() => setShowDiaryHistory(!showDiaryHistory)}
              className="text-[10px] font-bold text-primary"
            >
              {showDiaryHistory ? "접기" : "지난 일기 보기"}
            </button>
          )}
        </div>

        {/* Today's diary */}
        {diaryLoading ? (
          <div className="flex items-center gap-2 py-3">
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="text-lg">📝</motion.span>
            <span className="text-xs text-muted-foreground font-semibold">일기 쓰는 중...</span>
          </div>
        ) : diary ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-muted/50 rounded-xl p-3 border border-border"
          >
            <div className="flex items-start gap-2">
              <span className="text-lg mt-0.5">{MOOD_EMOJI[diary.mood] || "📝"}</span>
              <div>
                <p className="text-sm font-semibold text-foreground leading-relaxed">{diary.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1 font-bold">오늘</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <p className="text-xs text-muted-foreground font-semibold py-2">오늘은 아직 일기를 안 썼어요</p>
        )}

        {/* Diary history */}
        <AnimatePresence>
          {showDiaryHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-3 space-y-2"
            >
              {diaryHistory.filter(d => d.diary_date !== diary?.diary_date).map((d, i) => (
                <div key={i} className="bg-muted/30 rounded-lg p-2.5 border border-border/50">
                  <div className="flex items-start gap-2">
                    <span className="text-sm">{MOOD_EMOJI[d.mood] || "📝"}</span>
                    <div>
                      <p className="text-xs font-semibold text-foreground/80">{d.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-bold">{d.diary_date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default PetMain;
