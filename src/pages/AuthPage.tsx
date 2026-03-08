import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success("환영합니다! 🎉");
        navigate("/dashboard");
      } else {
        await signUp(email, password, displayName);
        toast.success("회원가입 완료! 이메일을 확인해주세요 📧");
      }
    } catch (err: any) {
      toast.error(err.message || "오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center mb-8"
      >
        <div className="text-6xl mb-4">🌍</div>
        <h1 className="text-3xl font-extrabold text-foreground">LangSync</h1>
        <p className="text-muted-foreground mt-2">모국어만큼만 외국어를 배우세요</p>
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="duo-card w-full max-w-sm"
      >
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${
              isLogin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${
              !isLogin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                key="name"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <input
                  type="text"
                  placeholder="닉네임"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground font-semibold focus:border-primary focus:outline-none transition-colors"
                  required={!isLogin}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground font-semibold focus:border-primary focus:outline-none transition-colors"
            required
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground font-semibold focus:border-primary focus:outline-none transition-colors pr-12"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="duo-btn-primary w-full disabled:opacity-50"
          >
            {submitting ? "⏳" : isLogin ? "시작하기" : "가입하기"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AuthPage;
