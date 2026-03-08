import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Flame, Zap, BookOpen, MessageCircle, Upload, BarChart3, PawPrint } from "lucide-react";
import { Link } from "react-router-dom";
import { checkAndAwardMilestone } from "@/lib/milestones";
import { toast } from "sonner";
import DashboardPetWidget from "@/components/dashboard/DashboardPetWidget";
import PersonalizedRecommendations from "@/components/dashboard/PersonalizedRecommendations";
import { useReminder } from "@/hooks/useReminder";

const LANG_NAMES: Record<string, string> = {
  ko: "한국어", en: "English", ja: "日本語", zh: "中文",
  es: "Español", fr: "Français", de: "Deutsch", pt: "Português",
};

const DashboardPage = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ nativeWords: 0, targetWords: 0, cardsToReview: 0, streak: 0 });

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
        streak: profile?.streak_days || 0,
      });

      // Check milestone rewards
      if (profile?.streak_days) {
        const milestone = await checkAndAwardMilestone(user.id, profile.streak_days);
        if (milestone) {
          toast.success(`${milestone.badge} ${milestone.name} 달성! +${milestone.points}P`);
        }
      }
    };
    fetchStats();
  }, [user, profile]);

  if (!profile) return null;

  const syncRatio = stats.nativeWords > 0 ? Math.min((stats.targetWords / stats.nativeWords) * 100, 100) : 0;

  return (
    <AppLayout>
      {/* Header */}
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            안녕, {profile.display_name || "학습자"}! 👋
          </h1>
          <p className="text-sm text-muted-foreground font-semibold">
            {LANG_NAMES[profile.native_language]} → {LANG_NAMES[profile.target_language]}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-secondary/20 rounded-full px-3 py-1.5">
          <Flame className="text-duo-orange" size={18} />
          <span className="font-extrabold text-foreground">{stats.streak}</span>
        </div>
      </motion.div>

      {/* Sync Progress */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="duo-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground">언어 동기화율</h3>
          <span className="text-sm font-extrabold text-primary">{Math.round(syncRatio)}%</span>
        </div>
        <div className="duo-progress-bar mb-3">
          <div className="duo-progress-fill" style={{ width: `${syncRatio}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground font-semibold">
          <span>모국어 {stats.nativeWords.toLocaleString()}단어</span>
          <span>학습 {stats.targetWords.toLocaleString()}단어</span>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="duo-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="text-primary" size={20} />
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">{profile.total_xp}</div>
            <div className="text-xs text-muted-foreground font-semibold">총 XP</div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="duo-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-duo-blue/10 flex items-center justify-center">
            <BookOpen className="text-duo-blue" size={20} />
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">{stats.cardsToReview}</div>
            <div className="text-xs text-muted-foreground font-semibold">복습 카드</div>
          </div>
        </motion.div>
      </div>

      {/* Personalized Recommendations */}
      <PersonalizedRecommendations />

      {/* Pet Widget */}
      <DashboardPetWidget />

      {/* Stats link */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.28 }}>
        <Link to="/stats" className="duo-card flex items-center gap-4 p-4 mb-4 cursor-pointer hover:scale-[1.01] transition-transform">
          <div className="w-12 h-12 rounded-2xl bg-duo-purple/20 flex items-center justify-center">
            <BarChart3 className="text-duo-purple" size={24} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-foreground">학습 통계</div>
            <div className="text-xs text-muted-foreground font-semibold">일별/주별 학습량과 동기화율 차트</div>
          </div>
        </Link>
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-3">
        <Link to="/import" className="duo-card flex items-center gap-4 p-4 cursor-pointer hover:scale-[1.01] transition-transform">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
            <Upload className="text-primary-foreground" size={24} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-foreground">모국어 분석하기</div>
            <div className="text-xs text-muted-foreground font-semibold">대화를 입력하고 학습량을 알아보세요</div>
          </div>
        </Link>

        <Link to="/chat" className="duo-card flex items-center gap-4 p-4 cursor-pointer hover:scale-[1.01] transition-transform">
          <div className="w-12 h-12 rounded-2xl bg-duo-blue flex items-center justify-center">
            <MessageCircle className="text-accent-foreground" size={24} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-foreground">회화 연습하기</div>
            <div className="text-xs text-muted-foreground font-semibold">AI와 대화하며 실력을 키우세요</div>
          </div>
        </Link>

        {stats.cardsToReview > 0 && (
          <Link to="/cards" className="duo-card flex items-center gap-4 p-4 cursor-pointer hover:scale-[1.01] transition-transform border-secondary">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
              <BookOpen className="text-secondary-foreground" size={24} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-foreground">복습하기</div>
              <div className="text-xs text-muted-foreground font-semibold">{stats.cardsToReview}개 카드가 기다리고 있어요</div>
            </div>
          </Link>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default DashboardPage;
