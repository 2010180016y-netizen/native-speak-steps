import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, BellOff, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { disablePush, enablePush, pushSupported } from "@/lib/push";

const TIME_OPTIONS = [
  "06:00", "07:00", "08:00", "09:00", "10:00",
  "12:00", "14:00", "16:00", "18:00", "19:00",
  "20:00", "21:00", "22:00",
];

const ReminderSettings = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const reminderEnabled = (profile as any)?.reminder_enabled ?? false;
  const reminderTime = (profile as any)?.reminder_time ?? "20:00";

  const handleToggle = async (enabled: boolean) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ reminder_enabled: enabled } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
      if (!enabled) {
        await disablePush();
        toast.success("리마인더가 꺼졌습니다");
      } else if (await enablePush()) {
        toast.success("리마인더가 켜졌습니다. 앱을 닫아도 알려드려요 🔔");
      } else {
        toast.warning("알림 권한이 없어 앱을 열었을 때만 알려드려요");
      }
    } catch {
      toast.error("설정 저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleTimeChange = async (time: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ reminder_time: time } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success(`리마인더 시간: ${time}`);
    } catch {
      toast.error("설정 저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="duo-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {reminderEnabled ? (
            <Bell className="text-primary" size={20} />
          ) : (
            <BellOff className="text-muted-foreground" size={20} />
          )}
          <h3 className="font-bold text-foreground">학습 리마인더</h3>
        </div>
        <Switch
          checked={reminderEnabled}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
      </div>

      {reminderEnabled && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
            <Clock size={14} />
            <span>알림 시간</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((time) => (
              <button
                key={time}
                onClick={() => handleTimeChange(time)}
                disabled={saving}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  reminderTime === time
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {time}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {pushSupported()
              ? "설정한 시간에 복습할 카드와 연속 학습 기록을 알림으로 보내드려요."
              : "이 브라우저는 앱이 닫혀 있을 때 알림을 받을 수 없어요. 설정한 시간 전후로 앱에 접속하면 알려드려요. (iOS는 홈 화면에 추가하면 알림을 받을 수 있어요)"}
          </p>
        </div>
      )}
    </div>
  );
};

export default ReminderSettings;
