import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const REMINDER_SHOWN_KEY = "reminder_shown_date";

export const useReminder = () => {
  const { profile } = useAuth();
  const shown = useRef(false);

  useEffect(() => {
    if (!profile || shown.current) return;

    const enabled = (profile as any)?.reminder_enabled;
    const reminderTime = (profile as any)?.reminder_time ?? "20:00";

    if (!enabled) return;

    // Only show once per day
    const today = new Date().toDateString();
    const lastShown = localStorage.getItem(REMINDER_SHOWN_KEY);
    if (lastShown === today) return;

    const now = new Date();
    const [hours, minutes] = reminderTime.split(":").map(Number);
    const reminderDate = new Date();
    reminderDate.setHours(hours, minutes, 0, 0);

    // Show if within ±60 minutes of reminder time
    const diffMs = Math.abs(now.getTime() - reminderDate.getTime());
    const diffMin = diffMs / 60000;

    if (diffMin <= 60) {
      shown.current = true;
      localStorage.setItem(REMINDER_SHOWN_KEY, today);
      toast("📚 학습 시간이에요!", {
        description: "오늘의 학습 목표를 달성해 보세요! 💪",
        duration: 8000,
        action: {
          label: "복습하기",
          onClick: () => window.location.assign("/cards"),
        },
      });
    }
  }, [profile]);
};
