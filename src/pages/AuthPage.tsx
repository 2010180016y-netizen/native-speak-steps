import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, Sparkles, Globe, BookOpen, Trophy } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import ForgotPasswordModal from "@/components/auth/ForgotPasswordModal";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
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

  const features = [
    { icon: Globe, text: "10+ 언어 지원", color: "text-blue-500" },
    { icon: BookOpen, text: "AI 맞춤 학습", color: "text-green-500" },
    { icon: Trophy, text: "게이미피케이션", color: "text-yellow-500" },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-primary/5 via-background to-accent/10">
      {/* Left Side - Branding */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
      >
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-20 h-20 rounded-full bg-primary/10"
              initial={{ 
                x: Math.random() * 400, 
                y: Math.random() * 600,
                scale: 0.5 + Math.random() * 0.5
              }}
              animate={{ 
                y: [null, Math.random() * 600],
                x: [null, Math.random() * 400],
              }}
              transition={{ 
                duration: 10 + Math.random() * 10,
                repeat: Infinity,
                repeatType: "reverse"
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            className="text-8xl mb-6"
          >
            🌍
          </motion.div>
          
          <h1 className="text-5xl font-black text-foreground mb-4">
            Lang<span className="text-primary">Sync</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-md">
            모국어만큼 자연스럽게<br />외국어를 마스터하세요
          </p>

          <div className="flex flex-col gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3 bg-card/80 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg"
              >
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
                <span className="font-semibold text-foreground">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Right Side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-6xl mb-3"
            >
              🌍
            </motion.div>
            <h1 className="text-3xl font-black text-foreground">
              Lang<span className="text-primary">Sync</span>
            </h1>
          </div>

          {/* Auth Card */}
          <div className="bg-card rounded-3xl shadow-2xl border-2 border-border/50 overflow-hidden">
            {/* Tab Switcher */}
            <div className="flex bg-muted/50 p-1.5">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all duration-300 ${
                  isLogin 
                    ? "bg-primary text-primary-foreground shadow-lg transform scale-[1.02]" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                로그인
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all duration-300 ${
                  !isLogin 
                    ? "bg-primary text-primary-foreground shadow-lg transform scale-[1.02]" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                회원가입
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                  {!isLogin && (
                    <motion.div
                      key="name"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <label className="block text-sm font-bold text-muted-foreground mb-2">
                        닉네임
                      </label>
                      <input
                        type="text"
                        placeholder="멋진 닉네임을 입력하세요"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border-2 border-border bg-background text-foreground font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/20 focus:outline-none transition-all"
                        required={!isLogin}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-sm font-bold text-muted-foreground mb-2">
                    이메일
                  </label>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-border bg-background text-foreground font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/20 focus:outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-muted-foreground mb-2">
                    비밀번호
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="6자 이상 입력하세요"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl border-2 border-border bg-background text-foreground font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/20 focus:outline-none transition-all pr-12"
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
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-primary font-medium hover:underline mt-1"
                    >
                      비밀번호를 잊으셨나요?
                    </button>
                  )}
                </div>

                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      ⏳
                    </motion.div>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      {isLogin ? "학습 시작하기" : "무료로 시작하기"}
                    </>
                  )}
                </motion.button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-border/50" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-card px-4 text-muted-foreground font-medium">
                    또는 소셜 계정으로
                  </span>
                </div>
              </div>

              {/* Social Login */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={async () => {
                  const { error } = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (error) toast.error("Google 로그인 실패");
                }}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border-2 border-border bg-background font-bold text-foreground hover:bg-muted hover:border-muted-foreground/30 transition-all duration-300"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google로 계속하기
              </motion.button>

              {/* Footer Text */}
              <p className="text-center text-xs text-muted-foreground mt-6">
                계속하면 <span className="text-primary font-medium">이용약관</span> 및{" "}
                <span className="text-primary font-medium">개인정보처리방침</span>에 동의하게 됩니다.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
