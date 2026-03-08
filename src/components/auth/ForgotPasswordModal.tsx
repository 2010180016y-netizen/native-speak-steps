import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { X, Mail, ArrowLeft, CheckCircle } from "lucide-react";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ForgotPasswordModal = ({ isOpen, onClose }: ForgotPasswordModalProps) => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      setSent(true);
      toast.success("비밀번호 재설정 이메일을 발송했습니다 📧");
    } catch (err: any) {
      toast.error(err.message || "이메일 발송에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setSent(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card rounded-3xl shadow-2xl border-2 border-border/50 p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <h2 className="text-xl font-bold text-foreground">비밀번호 찾기</h2>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {sent ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-6"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  이메일을 확인해주세요!
                </h3>
                <p className="text-muted-foreground text-sm mb-6">
                  <span className="font-semibold text-foreground">{email}</span>으로
                  <br />
                  비밀번호 재설정 링크를 보냈습니다.
                </p>
                <p className="text-muted-foreground text-xs mb-4">
                  이메일이 도착하지 않았다면 스팸함을 확인해주세요.
                </p>
                <button
                  onClick={handleClose}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold"
                >
                  확인
                </button>
              </motion.div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    가입한 이메일 주소를 입력하시면
                    <br />
                    비밀번호 재설정 링크를 보내드립니다.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
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

                  <motion.button
                    type="submit"
                    disabled={submitting || !email}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                  >
                    {submitting ? "발송 중..." : "재설정 링크 받기"}
                  </motion.button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ForgotPasswordModal;
