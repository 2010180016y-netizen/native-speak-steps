import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Zap, BookOpen, MessageCircle, Upload, BarChart3, Trophy, ChevronDown, Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { getEffectiveStreak } from "@/lib/streak";
import { toast } from "sonner";
import DashboardPetWidget from "@/components/dashboard/DashboardPetWidget";
import PersonalizedRecommendations from "@/components/dashboard/PersonalizedRecommendations";
import { useReminder } from "@/hooks/useReminder";
import WeeklyReportWidget from "@/components/dashboard/WeeklyReportWidget";
import GoalProgressWidget from "@/components/dashboard/GoalProgressWidget";
import VocabGrowthMap from "@/components/stats/VocabGrowthMap";
import DashboardSpeakingWidget from "@/components/dashboard/DashboardSpeakingWidget";

import { LANGUAGES, LANG_NAMES } from "@/lib/constants";
import { FEATURES } from "@/lib/features";

// Stagger animation variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { y: 24, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

const DashboardPage = () => {
  const { profile, user, updateProfile } = useAuth();
  const navigate = useNavigate();
  useReminder();
  const [stats, setStats] = useState({ nativeWords: 0, targetWords: 0, cardsToReview: 0, streak: 0 });
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [langPickerType, setLangPickerType] = useState<"native" | "target">("native");

  const handleLanguageChange = async (code: string) => {
    if (!profile) return;
    const updates = langPickerType === "native"
      ? { native_language: code }
      : { target_language: code };
    
    if (langPickerType === "native" && code === profile.target_language) {
      toast.error("모국어와 학습 언어는 다르게 설정해야 합니다");
      return;
    }
    if (langPickerType === "target" && code === profile.native_language) {
      toast.error("모국어와 학습 언어는 다르게 설정해야 합니다");
      return;
    }

    try {
      await updateProfile(updates);
      toast.success("언어 설정이 변경되었습니다 ✅");
      setShowLangPicker(false);
    } catch {
      toast.error("변경에 실패했습니다");
    }
  };

  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding", { replace: true });
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const [importsRes, cardsRes] = await Promise.all([
        supabase.from("language_imports").select("word_count").eq("user_id", user.id),
        supabase.from("srs_cards").select("id").eq("user_id", user.id).lte("next_review_at", new Date().toISOString()),
      ]);

      const nativeWords = (importsRes.data || []).reduce((sum, i) => sum + i.word_count, 0);
      setStats({
        nativeWords,
        targetWords: Math.round(nativeWords * 0.7),
        cardsToReview: cardsRes.data?.length || 0,
        streak: profile ? getEffectiveStreak(profile) : 0,
      });
    };
    fetchStats();
  }, [user, profile]);

  if (!profile) return null;

  const syncRatio = stats.nativeWords > 0 ? Math.min((stats.targetWords / stats.nativeWords) * 100, 100) : 0;

  return (
    <AppLayout>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
        {/* ── Header ── */}
        <motion.div variants={item} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">
              안녕, {profile.display_name || "학습자"}! 👋
            </h1>
            <div className="flex items-center gap-1 text-sm text-muted-foreground font-semibold mt-0.5">
              <button 
                onClick={() => { setLangPickerType("native"); setShowLangPicker(true); }}
                className="flex items-center gap-0.5 hover:text-foreground transition-colors px-1.5 py-0.5 rounded-lg hover:bg-muted"
              >
                {LANGUAGES.find(l => l.code === profile.native_language)?.flag} {LANG_NAMES[profile.native_language]}
                <ChevronDown size={12} />
              </button>
              <span className="text-muted-foreground/50">→</span>
              <button
                onClick={() => { setLangPickerType("target"); setShowLangPicker(true); }}
                className="flex items-center gap-0.5 hover:text-foreground transition-colors px-1.5 py-0.5 rounded-lg hover:bg-muted"
              >
                {LANGUAGES.find(l => l.code === profile.target_language)?.flag} {LANG_NAMES[profile.target_language]}
                <ChevronDown size={12} />
              </button>
            </div>
          </div>
          <motion.div
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 bg-duo-orange/10 rounded-2xl px-4 py-2 border border-duo-orange/20"
          >
            <Flame className="text-duo-orange" size={20} />
            <span className="font-extrabold text-duo-orange text-lg">{stats.streak}</span>
          </motion.div>
        </motion.div>

        {/* Language Picker Modal */}
        <AnimatePresence>
          {showLangPicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center"
              onClick={() => setShowLangPicker(false)}
            >
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                className="bg-card rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 pb-8 shadow-2xl border border-border"
              >
                <h3 className="text-lg font-extrabold text-foreground mb-1">
                  {langPickerType === "native" ? "모국어 변경" : "학습 언어 변경"}
                </h3>
                <p className="text-xs text-muted-foreground font-semibold mb-4">
                  {langPickerType === "native" ? "가장 자주 사용하는 언어를 선택하세요" : "배우고 싶은 언어를 선택하세요"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGES
                    .filter(l => langPickerType === "native" ? l.code !== profile.target_language : l.code !== profile.native_language)
                    .map(lang => {
                      const isSelected = langPickerType === "native"
                        ? lang.code === profile.native_language
                        : lang.code === profile.target_language;
                      return (
                        <motion.button
                          key={lang.code}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleLanguageChange(lang.code)}
                          className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                            isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                          }`}
                        >
                          <span className="text-xl">{lang.flag}</span>
                          <span className="font-bold text-sm text-foreground">{lang.label}</span>
                          {isSelected && <Check size={14} className="text-primary ml-auto" />}
                        </motion.button>
                      );
                    })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ Section 1: 현재 상태 ═══ */}

        {/* Sync Progress Hero */}
        <motion.div variants={item} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                <h3 className="font-bold text-foreground">언어 동기화율</h3>
              </div>
              <span className="text-2xl font-extrabold text-primary">{Math.round(syncRatio)}%</span>
            </div>
            <div className="h-3 rounded-full bg-primary/10 overflow-hidden mb-3">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-duo-blue"
                initial={{ width: 0 }}
                animate={{ width: `${syncRatio}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground font-semibold">
              <span>모국어 {stats.nativeWords.toLocaleString()}단어</span>
              <span>학습 {stats.targetWords.toLocaleString()}단어</span>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats + Goal in a row */}
        <motion.div variants={item} className="grid grid-cols-2 gap-3">
          <motion.div whileHover={{ scale: 1.02 }} className="bg-card rounded-2xl p-4 border border-border flex items-center gap-3 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Zap className="text-primary" size={22} />
            </div>
            <div>
              <div className="text-xl font-extrabold text-foreground">{profile.total_xp.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">총 XP</div>
            </div>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} className="bg-card rounded-2xl p-4 border border-border flex items-center gap-3 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-duo-blue/20 to-duo-blue/5 flex items-center justify-center">
              <BookOpen className="text-duo-blue" size={22} />
            </div>
            <div>
              <div className="text-xl font-extrabold text-foreground">{stats.cardsToReview}</div>
              <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">복습 카드</div>
            </div>
          </motion.div>
        </motion.div>

        {/* Goal Progress */}
        <motion.div variants={item}>
          <GoalProgressWidget />
        </motion.div>

        {/* ═══ Section 2: 빠른 학습 ═══ */}
        <motion.div variants={item}>
          <p className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-widest mb--1">빠른 학습</p>
        </motion.div>

        <motion.div variants={item} className="space-y-2.5">
          {stats.cardsToReview > 0 && (
            <QuickActionCard
              to="/cards"
              icon={<BookOpen size={22} />}
              gradient="from-secondary to-duo-orange"
              title="복습하기"
              desc={`${stats.cardsToReview}개 카드가 기다리고 있어요`}
              highlight
            />
          )}
          <QuickActionCard
            to="/import"
            icon={<Upload size={22} />}
            gradient="from-primary to-duo-blue"
            title="모국어 분석하기"
            desc="대화를 입력하고 학습량을 알아보세요"
          />
          <QuickActionCard
            to="/chat"
            icon={<MessageCircle size={22} />}
            gradient="from-duo-blue to-duo-purple"
            title="회화 연습하기"
            desc="AI와 대화하며 실력을 키우세요"
          />
        </motion.div>

        {/* ═══ Section 3: 내 펫 ═══ */}
        {FEATURES.pets && (
          <motion.div variants={item}>
            <DashboardPetWidget />
          </motion.div>
        )}

        {/* ═══ Section 4: 학습 인사이트 ═══ */}
        <motion.div variants={item}>
          <p className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-widest">학습 인사이트</p>
        </motion.div>

        {/* Speaking Score Widget */}
        <motion.div variants={item}>
          <DashboardSpeakingWidget />
        </motion.div>

        {/* Vocab Growth Map */}
        {user && (
          <motion.div variants={item}>
            <VocabGrowthMap userId={user.id} />
          </motion.div>
        )}

        {/* Weekly Report */}
        {FEATURES.aiWeeklyReport && (
          <motion.div variants={item}>
            <WeeklyReportWidget />
          </motion.div>
        )}

        {/* Personalized Recommendations */}
        {FEATURES.aiRecommendations && (
          <motion.div variants={item}>
            <PersonalizedRecommendations />
          </motion.div>
        )}

        {/* ═══ Section 5: 더 알아보기 ═══ */}
        <motion.div variants={item}>
          <p className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-widest">더 알아보기</p>
        </motion.div>

        <motion.div variants={item} className={`grid gap-2.5 ${FEATURES.leaderboard ? "grid-cols-2" : "grid-cols-1"}`}>
          {FEATURES.leaderboard && (
            <Link to="/leaderboard">
              <motion.div
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="bg-card rounded-2xl p-4 border border-border shadow-sm text-center"
              >
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/80 to-primary mx-auto flex items-center justify-center text-white mb-2">
                  <Trophy size={22} />
                </div>
                <div className="font-bold text-foreground text-sm">리더보드</div>
                <div className="text-[10px] text-muted-foreground font-semibold">순위 확인</div>
              </motion.div>
            </Link>
          )}
          <Link to="/stats">
            <motion.div
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="bg-card rounded-2xl p-4 border border-border shadow-sm text-center"
            >
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-duo-purple to-duo-blue mx-auto flex items-center justify-center text-white mb-2">
                <BarChart3 size={22} />
              </div>
              <div className="font-bold text-foreground text-sm">학습 통계</div>
              <div className="text-[10px] text-muted-foreground font-semibold">상세 분석</div>
            </motion.div>
          </Link>
        </motion.div>

        {/* Bottom spacer */}
        <div className="h-2" />
      </motion.div>
    </AppLayout>
  );
};

// Unified quick action card component
const QuickActionCard = ({
  to, icon, gradient, title, desc, highlight,
}: {
  to: string;
  icon: React.ReactNode;
  gradient: string;
  title: string;
  desc: string;
  highlight?: boolean;
}) => (
  <Link to={to}>
    <motion.div
      whileHover={{ scale: 1.015, y: -1 }}
      whileTap={{ scale: 0.985 }}
      className={`bg-card rounded-2xl flex items-center gap-4 p-4 border transition-shadow cursor-pointer ${
        highlight ? "border-secondary/40 shadow-sm" : "border-border shadow-sm"
      }`}
    >
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-foreground text-sm">{title}</div>
        <div className="text-xs text-muted-foreground font-semibold">{desc}</div>
      </div>
    </motion.div>
  </Link>
);

export default DashboardPage;
