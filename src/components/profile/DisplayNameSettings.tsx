import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { DISPLAY_NAME_MAX_LENGTH, getDisplayNameError } from "@/lib/displayName";

const DisplayNameSettings = () => {
  const { profile, updateProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const trimmed = name.trim();
  const unchanged = trimmed === (profile.display_name ?? "");

  const handleSave = async () => {
    const error = getDisplayNameError(name);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ display_name: trimmed });
      setName(trimmed);
      toast.success("닉네임이 변경되었습니다 ✅");
    } catch {
      toast.error("닉네임 변경에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="duo-card">
      <div className="flex items-center gap-2 mb-1">
        <UserRound size={18} className="text-primary" />
        <h3 className="font-bold text-foreground">닉네임</h3>
      </div>
      <p className="text-xs text-muted-foreground font-semibold mb-3">리더보드에 다른 학습자에게 표시되는 이름이에요</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          placeholder="멋진 닉네임을 입력하세요"
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border-2 border-border bg-background text-foreground font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none transition-all"
        />
        <button
          onClick={handleSave}
          disabled={saving || unchanged}
          className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 transition-opacity"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
};

export default DisplayNameSettings;
