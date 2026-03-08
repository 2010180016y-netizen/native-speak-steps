import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

const LANGUAGES = [
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
];

const LEVELS = [
  { value: "beginner", label: "초보자", emoji: "🌱", desc: "기초부터 시작" },
  { value: "elementary", label: "초급", emoji: "🌿", desc: "간단한 표현 가능" },
  { value: "intermediate", label: "중급", emoji: "🌳", desc: "일상 대화 가능" },
  { value: "advanced", label: "고급", emoji: "🏔️", desc: "복잡한 주제도 OK" },
];

const OnboardingPage = () => {
  const [step, setStep] = useState(0);
  const [nativeLang, setNativeLang] = useState("ko");
  const [targetLang, setTargetLang] = useState("");
  const [level, setLevel] = useState("");
  const { updateProfile } = useAuth();
  const navigate = useNavigate();

  const handleComplete = async () => {
    try {
      await updateProfile({
        native_language: nativeLang,
        target_language: targetLang,
        current_level: level,
        onboarding_completed: true,
      });
      toast.success("설정 완료! 학습을 시작하세요 🚀");
      navigate("/dashboard");
    } catch {
      toast.error("설정 저장에 실패했습니다");
    }
  };

  const steps = [
    // Step 0: Native language
    <motion.div key="native" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }}>
      <h2 className="text-2xl font-extrabold text-foreground mb-2">모국어를 선택하세요</h2>
      <p className="text-muted-foreground mb-6">평소 가장 많이 사용하는 언어예요</p>
      <div className="grid grid-cols-2 gap-3">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => { setNativeLang(lang.code); setStep(1); }}
            className={`duo-card flex items-center gap-3 p-4 cursor-pointer transition-all hover:scale-[1.02] ${
              nativeLang === lang.code ? "border-primary" : ""
            }`}
          >
            <span className="text-2xl">{lang.flag}</span>
            <span className="font-bold text-foreground">{lang.label}</span>
          </button>
        ))}
      </div>
    </motion.div>,

    // Step 1: Target language
    <motion.div key="target" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }}>
      <h2 className="text-2xl font-extrabold text-foreground mb-2">어떤 언어를 배울까요?</h2>
      <p className="text-muted-foreground mb-6">모국어 사용량에 맞춰 학습량을 조절해 드려요</p>
      <div className="grid grid-cols-2 gap-3">
        {LANGUAGES.filter((l) => l.code !== nativeLang).map((lang) => (
          <button
            key={lang.code}
            onClick={() => { setTargetLang(lang.code); setStep(2); }}
            className={`duo-card flex items-center gap-3 p-4 cursor-pointer transition-all hover:scale-[1.02] ${
              targetLang === lang.code ? "border-primary" : ""
            }`}
          >
            <span className="text-2xl">{lang.flag}</span>
            <span className="font-bold text-foreground">{lang.label}</span>
          </button>
        ))}
      </div>
    </motion.div>,

    // Step 2: Level
    <motion.div key="level" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }}>
      <h2 className="text-2xl font-extrabold text-foreground mb-2">현재 실력은?</h2>
      <p className="text-muted-foreground mb-6">딱 맞는 난이도로 시작할게요</p>
      <div className="space-y-3">
        {LEVELS.map((lv) => (
          <button
            key={lv.value}
            onClick={() => { setLevel(lv.value); }}
            className={`duo-card w-full flex items-center gap-4 p-4 cursor-pointer transition-all hover:scale-[1.01] ${
              level === lv.value ? "border-primary" : ""
            }`}
          >
            <span className="text-3xl">{lv.emoji}</span>
            <div className="text-left">
              <div className="font-bold text-foreground">{lv.label}</div>
              <div className="text-sm text-muted-foreground">{lv.desc}</div>
            </div>
          </button>
        ))}
      </div>
      {level && (
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={handleComplete}
          className="duo-btn-primary w-full mt-6 flex items-center justify-center gap-2"
        >
          시작하기 <ChevronRight size={20} />
        </motion.button>
      )}
    </motion.div>,
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Progress */}
      <div className="w-full max-w-md mb-8">
        <div className="duo-progress-bar">
          <div className="duo-progress-fill" style={{ width: `${((step + 1) / 3) * 100}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground font-bold">
          <span>모국어</span>
          <span>학습 언어</span>
          <span>레벨</span>
        </div>
      </div>

      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>
      </div>

      {step > 0 && (
        <button
          onClick={() => setStep(step - 1)}
          className="mt-4 text-muted-foreground font-bold text-sm hover:text-foreground transition-colors"
        >
          ← 이전
        </button>
      )}
    </div>
  );
};

export default OnboardingPage;
