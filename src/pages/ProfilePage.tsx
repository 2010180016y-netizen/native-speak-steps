import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { LogOut, Flame, Zap, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReminderSettings from "@/components/profile/ReminderSettings";
import GoalSettings from "@/components/profile/GoalSettings";
import { LANG_NAMES, LEVEL_NAMES } from "@/lib/constants";

const ProfilePage = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  if (!profile) return null;

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <AppLayout>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-6">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3 text-4xl">
          {profile.display_name?.[0]?.toUpperCase() || "?"}
        </div>
        <h1 className="text-2xl font-extrabold text-foreground">{profile.display_name || "학습자"}</h1>
        <p className="text-sm text-muted-foreground font-semibold">{LEVEL_NAMES[profile.current_level]}</p>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-3">
        <div className="duo-card">
          <h3 className="font-bold text-foreground mb-3">학습 정보</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground font-semibold">모국어</span>
              <span className="font-bold text-foreground">{LANG_NAMES[profile.native_language]}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground font-semibold">학습 언어</span>
              <span className="font-bold text-foreground">{LANG_NAMES[profile.target_language]}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="duo-card text-center">
            <Flame className="text-duo-orange mx-auto mb-1" size={24} />
            <div className="text-lg font-extrabold text-foreground">{profile.streak_days}</div>
            <div className="text-[10px] text-muted-foreground font-bold">연속</div>
          </div>
          <div className="duo-card text-center">
            <Zap className="text-primary mx-auto mb-1" size={24} />
            <div className="text-lg font-extrabold text-foreground">{profile.total_xp}</div>
            <div className="text-[10px] text-muted-foreground font-bold">XP</div>
          </div>
          <div className="duo-card text-center">
            <BookOpen className="text-duo-blue mx-auto mb-1" size={24} />
            <div className="text-lg font-extrabold text-foreground">{profile.current_level === "beginner" ? "A1" : profile.current_level === "elementary" ? "A2" : profile.current_level === "intermediate" ? "B1" : "B2"}</div>
            <div className="text-[10px] text-muted-foreground font-bold">레벨</div>
          </div>
        </div>

        <GoalSettings />

        <ReminderSettings />

        <button
          onClick={handleLogout}
          className="w-full duo-card flex items-center justify-center gap-2 p-3 cursor-pointer hover:border-destructive transition-colors"
        >
          <LogOut size={18} className="text-destructive" />
          <span className="font-bold text-destructive">로그아웃</span>
        </button>
      </motion.div>
    </AppLayout>
  );
};

export default ProfilePage;
