import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Briefcase, MessageCircle, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

export type Persona = {
  gender: "male" | "female";
  occupation: string;
  personality: string;
};

export type ChatScenario = {
  id: string;
  emoji: string;
  label: string;
  description: string;
};

const OCCUPATIONS = [
  "학생", "회사원", "프리랜서", "의사", "엔지니어", "교사",
  "예술가", "요리사", "변호사", "기자", "디자이너", "CEO",
];

const PERSONALITIES = [
  "유머러스한 😄", "차분한 😌", "에너지 넘치는 ⚡", "다정한 💕",
  "지적인 🧠", "솔직한 💬", "낙천적인 🌞", "신비로운 🔮",
];

const SCENARIOS: ChatScenario[] = [
  { id: "cafe", emoji: "☕", label: "카페 주문", description: "커피숍에서 음료 주문하기" },
  { id: "restaurant", emoji: "🍽️", label: "레스토랑", description: "레스토랑에서 식사 주문하기" },
  { id: "business_meeting", emoji: "💼", label: "비즈니스 미팅", description: "회의에서 프레젠테이션 및 토론" },
  { id: "job_interview", emoji: "🤝", label: "취업 면접", description: "면접관과 질의응답" },
  { id: "blind_date", emoji: "💕", label: "소개팅", description: "처음 만난 사람과 자연스럽게 대화" },
  { id: "school", emoji: "🏫", label: "학교 생활", description: "수업, 과제, 동아리 관련 대화" },
  { id: "airport", emoji: "✈️", label: "공항 / 여행", description: "체크인, 탑승, 길 묻기" },
  { id: "hotel", emoji: "🏨", label: "호텔 체크인", description: "예약 확인 및 체크인/아웃" },
  { id: "shopping", emoji: "🛍️", label: "쇼핑", description: "옷 가게에서 사이즈, 가격 묻기" },
  { id: "hospital", emoji: "🏥", label: "병원 방문", description: "증상 설명 및 진료 예약" },
  { id: "phone_call", emoji: "📞", label: "전화 통화", description: "전화로 예약하거나 문의하기" },
  { id: "neighbor", emoji: "🏠", label: "이웃 인사", description: "새로 이사한 이웃과 인사 나누기" },
  { id: "taxi", emoji: "🚕", label: "택시 / 교통", description: "택시 타기, 길 안내 요청" },
  { id: "bank", emoji: "🏦", label: "은행 업무", description: "계좌 개설, 송금 등 금융 업무" },
  { id: "gym", emoji: "💪", label: "헬스장", description: "트레이너와 운동 상담" },
  { id: "party", emoji: "🎉", label: "파티 / 모임", description: "파티에서 새로운 사람과 대화" },
  { id: "complaint", emoji: "😤", label: "불만 제기", description: "서비스 불만을 정중하게 전달" },
  { id: "roommate", emoji: "🛋️", label: "룸메이트", description: "룸메이트와 생활 규칙 정하기" },
  { id: "dating_app", emoji: "📱", label: "메시지 대화", description: "SNS/앱에서 가볍게 대화" },
  { id: "presentation", emoji: "📊", label: "발표 Q&A", description: "발표 후 질문에 답변하기" },
  { id: "cooking", emoji: "👨‍🍳", label: "요리 교실", description: "요리 수업에서 레시피 묻기" },
  { id: "emergency", emoji: "🚨", label: "긴급 상황", description: "길을 잃거나 도움 요청하기" },
  { id: "free", emoji: "✨", label: "자유 대화", description: "주제 제한 없이 자유롭게 대화" },
];

type Props = {
  onStart: (persona: Persona, scenario: ChatScenario) => void;
};

const ChatSetup = ({ onStart }: Props) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [occupation, setOccupation] = useState<string | null>(null);
  const [personality, setPersonality] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ChatScenario | null>(null);

  const canProceedStep1 = gender && occupation && personality;
  const canStart = canProceedStep1 && scenario;

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-2">
        {[1, 2].map((s) => (
          <div
            key={s}
            className={`w-8 h-1.5 rounded-full transition-colors ${
              step >= s ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="space-y-4"
          >
            <div className="text-center mb-2">
              <User size={28} className="mx-auto text-primary mb-1" />
              <h2 className="text-lg font-extrabold text-foreground">대화 상대 설정</h2>
              <p className="text-xs text-muted-foreground font-semibold">AI 대화 파트너의 페르소나를 선택하세요</p>
            </div>

            {/* Gender */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">성별</p>
              <div className="grid grid-cols-2 gap-2">
                {([["male", "👨 남성"], ["female", "👩 여성"]] as const).map(([g, label]) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                      gender === g
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Occupation */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">
                <Briefcase size={12} className="inline mr-1" />직업
              </p>
              <div className="flex flex-wrap gap-2">
                {OCCUPATIONS.map((o) => (
                  <button
                    key={o}
                    onClick={() => setOccupation(o)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                      occupation === o
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {/* Personality */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">
                <Sparkles size={12} className="inline mr-1" />성격
              </p>
              <div className="flex flex-wrap gap-2">
                {PERSONALITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPersonality(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                      personality === p
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="duo-btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              다음 <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            className="space-y-4"
          >
            <div className="text-center mb-2">
              <MessageCircle size={28} className="mx-auto text-duo-blue mb-1" />
              <h2 className="text-lg font-extrabold text-foreground">상황 선택</h2>
              <p className="text-xs text-muted-foreground font-semibold">어떤 상황에서 대화할까요?</p>
            </div>

            <button
              onClick={() => setStep(1)}
              className="text-xs font-bold text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ChevronLeft size={14} /> 페르소나 수정
            </button>

            {/* Selected persona summary */}
            <div className="duo-card py-2 px-3 flex items-center gap-2 text-xs">
              <span className="font-bold text-foreground">
                {gender === "male" ? "👨" : "👩"} {occupation}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-semibold text-muted-foreground">{personality}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pb-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScenario(s)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    scenario?.id === s.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="text-xl mb-1">{s.emoji}</div>
                  <div className="text-xs font-bold text-foreground">{s.label}</div>
                  <div className="text-[10px] font-semibold text-muted-foreground leading-tight mt-0.5">
                    {s.description}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (canStart) {
                  onStart(
                    { gender: gender!, occupation: occupation!, personality: personality! },
                    scenario!
                  );
                }
              }}
              disabled={!canStart}
              className="duo-btn-primary w-full py-3 font-bold disabled:opacity-40"
            >
              🗣️ 대화 시작
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatSetup;
