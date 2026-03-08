import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Target, Plus, Trash2, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Goal {
  id: string;
  goal_type: string;
  target_value: number;
  is_active: boolean;
}

const GOAL_TYPES: Record<string, { label: string; emoji: string; unit: string; presets: number[] }> = {
  daily_xp: { label: "일일 XP", emoji: "⚡", unit: "XP", presets: [30, 50, 100, 200] },
  daily_cards: { label: "일일 복습 카드", emoji: "📚", unit: "장", presets: [5, 10, 20, 50] },
  daily_minutes: { label: "일일 학습 시간", emoji: "⏱️", unit: "분", presets: [10, 20, 30, 60] },
  daily_chat: { label: "일일 대화 메시지", emoji: "💬", unit: "개", presets: [5, 10, 20, 30] },
  weekly_words: { label: "주간 단어 학습", emoji: "📝", unit: "개", presets: [20, 50, 100, 200] },
};

const GoalSettings = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedType, setSelectedType] = useState("");

  const fetchGoals = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("learning_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }) as any;
    setGoals(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchGoals(); }, [user]);

  const addGoal = async (goalType: string, targetValue: number) => {
    if (!user) return;
    const existing = goals.find(g => g.goal_type === goalType);
    if (existing) {
      toast.error("이미 설정된 목표입니다");
      return;
    }
    const { error } = await supabase.from("learning_goals").insert({
      user_id: user.id,
      goal_type: goalType,
      target_value: targetValue,
    } as any);
    if (error) { toast.error("목표 추가 실패"); return; }
    toast.success("목표가 추가되었습니다! 🎯");
    setAdding(false);
    setSelectedType("");
    fetchGoals();
  };

  const toggleGoal = async (id: string, isActive: boolean) => {
    await supabase.from("learning_goals").update({ is_active: isActive } as any).eq("id", id);
    fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    await supabase.from("learning_goals").delete().eq("id", id);
    toast.success("목표가 삭제되었습니다");
    fetchGoals();
  };

  const updateTarget = async (id: string, value: number) => {
    await supabase.from("learning_goals").update({ target_value: value } as any).eq("id", id);
    toast.success("목표가 수정되었습니다");
    fetchGoals();
  };

  const availableTypes = Object.keys(GOAL_TYPES).filter(t => !goals.find(g => g.goal_type === t));

  if (loading) {
    return (
      <div className="duo-card">
        <div className="flex items-center gap-2 mb-3">
          <Target className="text-primary" size={20} />
          <h3 className="font-bold text-foreground">학습 목표</h3>
        </div>
        <div className="h-20 rounded-xl bg-muted/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="duo-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="text-primary" size={20} />
          <h3 className="font-bold text-foreground">학습 목표</h3>
        </div>
        {availableTypes.length > 0 && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <Plus size={16} className="text-primary" />
          </button>
        )}
      </div>

      {/* Existing Goals */}
      {goals.length === 0 && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full p-4 rounded-xl border-2 border-dashed border-muted-foreground/20 text-center hover:border-primary/40 transition-colors"
        >
          <Target className="mx-auto mb-2 text-muted-foreground" size={24} />
          <p className="text-sm font-bold text-muted-foreground">목표를 설정해 보세요!</p>
          <p className="text-xs text-muted-foreground/70">탭하여 첫 번째 학습 목표 추가</p>
        </button>
      )}

      <div className="space-y-3">
        {goals.map((goal) => {
          const config = GOAL_TYPES[goal.goal_type];
          if (!config) return null;
          return (
            <div key={goal.id} className={`p-3 rounded-xl transition-colors ${goal.is_active ? "bg-muted/30" : "bg-muted/10 opacity-60"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{config.emoji}</span>
                  <span className="font-bold text-sm text-foreground">{config.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={goal.is_active}
                    onCheckedChange={(v) => toggleGoal(goal.id, v)}
                  />
                  <button onClick={() => deleteGoal(goal.id)} className="p-1 rounded hover:bg-destructive/10">
                    <Trash2 size={14} className="text-destructive/60" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                {config.presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => updateTarget(goal.id, p)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                      goal.target_value === p
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {p}{config.unit}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Goal */}
      {adding && (
        <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <p className="text-xs font-bold text-primary mb-2">목표 유형 선택</p>
          <div className="space-y-2">
            {availableTypes.map((type) => {
              const config = GOAL_TYPES[type];
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                    selectedType === type ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/30"
                  }`}
                >
                  <span>{config.emoji}</span>
                  <span className="text-sm font-bold text-foreground">{config.label}</span>
                </button>
              );
            })}
          </div>
          {selectedType && (
            <div className="mt-3">
              <p className="text-xs font-bold text-muted-foreground mb-2">목표값 선택</p>
              <div className="flex gap-2 flex-wrap">
                {GOAL_TYPES[selectedType].presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => addGoal(selectedType, p)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    {p}{GOAL_TYPES[selectedType].unit}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => { setAdding(false); setSelectedType(""); }}
            className="mt-2 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
};

export default GoalSettings;
