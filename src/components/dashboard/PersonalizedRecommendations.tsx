import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Sparkles, BookOpen, MessageCircle, Mic, Upload, BarChart3, RefreshCw, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Recommendation {
  title: string;
  description: string;
  category: "vocabulary" | "speaking" | "review" | "habit" | "challenge";
  priority: "high" | "medium" | "low";
  action_path: string;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof BookOpen; colorClass: string; bgClass: string }> = {
  vocabulary: { icon: BookOpen, colorClass: "text-primary", bgClass: "bg-primary/10" },
  speaking: { icon: Mic, colorClass: "text-duo-blue", bgClass: "bg-duo-blue/10" },
  review: { icon: RefreshCw, colorClass: "text-duo-orange", bgClass: "bg-duo-orange/10" },
  habit: { icon: BarChart3, colorClass: "text-duo-purple", bgClass: "bg-duo-purple/10" },
  challenge: { icon: Sparkles, colorClass: "text-secondary", bgClass: "bg-secondary/10" },
};

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  high: { label: "중요", className: "bg-destructive/10 text-destructive" },
  medium: { label: "추천", className: "bg-primary/10 text-primary" },
  low: { label: "도전", className: "bg-muted text-muted-foreground" },
};

const PersonalizedRecommendations = () => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecommendations = async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("personalized-recommendations");

      if (error) throw error;
      if (data?.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch (err: any) {
      console.error("Failed to fetch recommendations:", err);
      if (!isRefresh) {
        // Set fallback recommendations
        setRecommendations([
          { title: "복습 카드 확인하기", description: "오늘 복습할 카드를 확인해보세요.", category: "review", priority: "high", action_path: "/cards" },
          { title: "회화 연습하기", description: "AI와 대화하며 실력을 키워보세요.", category: "speaking", priority: "medium", action_path: "/chat" },
        ]);
      } else {
        toast.error("추천을 새로고침하지 못했습니다");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [user]);

  if (loading) {
    return (
      <div className="duo-card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="text-primary" size={18} />
          <h3 className="font-bold text-foreground">맞춤 추천</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15 }}
      className="duo-card mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary" size={18} />
          <h3 className="font-bold text-foreground">맞춤 추천</h3>
        </div>
        <button
          onClick={() => fetchRecommendations(true)}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={`text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={recommendations.map(r => r.title).join()} className="space-y-2">
          {recommendations.map((rec, idx) => {
            const config = CATEGORY_CONFIG[rec.category] || CATEGORY_CONFIG.challenge;
            const badge = PRIORITY_BADGE[rec.priority] || PRIORITY_BADGE.medium;
            const Icon = config.icon;

            return (
              <motion.div
                key={idx}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link
                  to={rec.action_path}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors group"
                >
                  <div className={`w-9 h-9 rounded-lg ${config.bgClass} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={config.colorClass} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground truncate">{rec.title}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium truncate">{rec.description}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default PersonalizedRecommendations;
