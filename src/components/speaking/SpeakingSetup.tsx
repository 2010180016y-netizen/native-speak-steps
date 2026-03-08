import { motion, AnimatePresence } from "framer-motion";
import { User, Phone, History } from "lucide-react";
import { Link } from "react-router-dom";
import type { Persona, ChatScenario } from "@/components/chat/ChatSetup";
import { OCCUPATIONS, PERSONALITIES, SCENARIOS } from "@/lib/constants";

interface Props {
  isSupported: boolean;
  onStartCall: (persona: Persona, scenario: ChatScenario) => void;
}

const SpeakingSetup = ({ isSupported, onStartCall }: Props) => {
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [occupation, setOccupation] = useState<string | null>(null);
  const [personality, setPersonality] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ChatScenario | null>(null);

  const canProceedStep1 = gender && occupation && personality;

  const handleReady = () => {
    if (!gender || !occupation || !personality || !scenario) return;
    onStartCall({ gender, occupation, personality }, scenario);
  };

  return (
    <>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-extrabold text-foreground">스피킹 연습 📞</h1>
          <Link
            to="/speaking-history"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-border text-muted-foreground text-xs font-bold hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <History size={14} /> 기록
          </Link>
        </div>
        <p className="text-sm text-muted-foreground font-semibold mb-5">
          페르소나를 설정하면 전화가 걸려와요!
        </p>
      </motion.div>

      {!isSupported && (
        <div className="duo-card bg-destructive/10 border-destructive/30 mb-4">
          <p className="text-sm font-bold text-destructive">⚠️ 이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용해주세요.</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mb-4">
        {[1, 2].map((s) => (
          <div key={s} className={`w-8 h-1.5 rounded-full transition-colors ${setupStep >= s ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {setupStep === 1 && (
          <motion.div key="s1" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
            <div className="text-center mb-2">
              <User size={28} className="mx-auto text-primary mb-1" />
              <h2 className="text-lg font-extrabold text-foreground">통화 상대 설정</h2>
              <p className="text-xs text-muted-foreground font-semibold">전화를 걸어올 AI 상대를 설정하세요</p>
            </div>

            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">성별</p>
              <div className="grid grid-cols-2 gap-2">
                {([["male", "👨 남성"], ["female", "👩 여성"]] as const).map(([g, label]) => (
                  <button key={g} onClick={() => setGender(g)} className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${gender === g ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:border-primary/50"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">직업</p>
              <div className="flex flex-wrap gap-2">
                {OCCUPATIONS.map((o) => (
                  <button key={o} onClick={() => setOccupation(o)} className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${occupation === o ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:border-primary/50"}`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">성격</p>
              <div className="flex flex-wrap gap-2">
                {PERSONALITIES.map((p) => (
                  <button key={p} onClick={() => setPersonality(p)} className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${personality === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:border-primary/50"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setSetupStep(2)} disabled={!canProceedStep1} className="duo-btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40">
              다음 →
            </button>
          </motion.div>
        )}

        {setupStep === 2 && (
          <motion.div key="s2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="space-y-4">
            <div className="text-center mb-2">
              <Phone size={28} className="mx-auto text-primary mb-1" />
              <h2 className="text-lg font-extrabold text-foreground">통화 상황 선택</h2>
              <p className="text-xs text-muted-foreground font-semibold">어떤 상황으로 전화가 올까요?</p>
            </div>

            <button onClick={() => setSetupStep(1)} className="text-xs font-bold text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
              ← 페르소나 수정
            </button>

            <div className="duo-card py-2 px-3 flex items-center gap-2 text-xs">
              <span className="font-bold text-foreground">{gender === "male" ? "👨" : "👩"} {occupation}</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-semibold text-muted-foreground">{personality}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[45vh] overflow-y-auto pb-2">
              {SCENARIOS.map((s) => (
                <button key={s.id} onClick={() => setScenario(s as ChatScenario)} className={`p-3 rounded-xl border-2 text-left transition-all ${scenario?.id === s.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"}`}>
                  <div className="text-xl mb-1">{s.emoji}</div>
                  <div className="text-xs font-bold text-foreground">{s.label}</div>
                  <div className="text-[10px] font-semibold text-muted-foreground leading-tight mt-0.5">{s.description}</div>
                </button>
              ))}
            </div>

            <button onClick={handleReady} disabled={!scenario} className="duo-btn-primary w-full py-3 font-bold disabled:opacity-40">
              📞 전화 받기 준비
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

import { useState } from "react";
export default SpeakingSetup;
