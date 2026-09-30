import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Activity, Heart } from "lucide-react";
import ActivityLogDashboard from "@/components/stats/ActivityLogDashboard";
import SrsHealthDashboard from "@/components/stats/SrsHealthDashboard";

const TABS = [
  { id: "srshealth", label: "SRS 건강", icon: Heart },
  { id: "activity", label: "활동 로그", icon: Activity },
] as const;

type TabId = (typeof TABS)[number]["id"];

const StatsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("srshealth");

  return (
    <AppLayout>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-extrabold text-foreground mb-1">학습 통계 📈</h1>
        <p className="text-sm text-muted-foreground font-semibold mb-4">
          학습 진행 상황을 한눈에 확인하세요
        </p>
      </motion.div>

      <div className="flex gap-2 mb-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2.5 px-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === id ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {user && (activeTab === "srshealth" ? <SrsHealthDashboard userId={user.id} /> : <ActivityLogDashboard userId={user.id} />)}
    </AppLayout>
  );
};

export default StatsPage;
