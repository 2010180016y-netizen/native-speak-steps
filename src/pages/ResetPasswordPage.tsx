import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we're in recovery mode from the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get("type");
    
    if (type === "recovery") {
      setIsRecoveryMode(true);
    } else {
      // Also check for access_token which indicates a valid recovery session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setIsRecoveryMode(true);
        }
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("비밀번호가 일치하지 않습니다");
      return;
    }

    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      toast.success("비밀번호가 성공적으로 변경되었습니다! 🎉");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "비밀번호 변경 중 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isRecoveryMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-3xl shadow-2xl border-2 border-border/50 p-8 max-w-md w-full text-center"
        >
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            유효하지 않은 링크
          </h1>
          <p className="text-muted-foreground mb-6">
            비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold"
          >
            로그인 페이지로 이동
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center mb-8"
      >
        <div className="text-6xl mb-4">🔐</div>
        <h1 className="text-3xl font-black text-foreground">
          새 비밀번호 설정
        </h1>
        <p className="text-muted-foreground mt-2">
          안전한 새 비밀번호를 입력해주세요
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-3xl shadow-2xl border-2 border-border/50 p-6 max-w-md w-full"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-muted-foreground mb-2">
              새 비밀번호
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="6자 이상 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 rounded-xl border-2 border-border bg-background text-foreground font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/20 focus:outline-none transition-all"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-muted-foreground mb-2">
              비밀번호 확인
            </label>
            <div className="relative">
              <CheckCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-border bg-background text-foreground font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/20 focus:outline-none transition-all"
                required
                minLength={6}
              />
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-destructive text-sm mt-1">비밀번호가 일치하지 않습니다</p>
            )}
          </div>

          <motion.button
            type="submit"
            disabled={submitting || password !== confirmPassword}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {submitting ? "변경 중..." : "비밀번호 변경"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
