import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { ArrowLeft, MessageSquare, Clock, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import ReactMarkdown from "react-markdown";

interface ChatSession {
  session_id: string;
  first_message: string;
  last_message_at: string;
  message_count: number;
  messages: { role: string; content: string; created_at: string }[];
}

const ChatHistoryPage = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchSessions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("chat_messages")
        .select("session_id, role, content, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Group by session_id
      const grouped: Record<string, { role: string; content: string; created_at: string }[]> = {};
      for (const msg of data) {
        if (!grouped[msg.session_id]) grouped[msg.session_id] = [];
        grouped[msg.session_id].push(msg);
      }

      const sessionList: ChatSession[] = Object.entries(grouped)
        .map(([session_id, messages]) => {
          const userMsgs = messages.filter((m) => m.role === "user");
          return {
            session_id,
            first_message: userMsgs[0]?.content || messages[0]?.content || "",
            last_message_at: messages[messages.length - 1]?.created_at || "",
            message_count: messages.length,
            messages,
          };
        })
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

      setSessions(sessionList);
      setLoading(false);
    };
    fetchSessions();
  }, [user]);

  return (
    <AppLayout>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-4">
        <Link to="/chat" className="text-xs font-bold text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors mb-3">
          <ArrowLeft size={14} /> 채팅으로 돌아가기
        </Link>
        <h1 className="text-2xl font-extrabold text-foreground">대화 히스토리 📜</h1>
        <p className="text-sm text-muted-foreground font-semibold">과거 대화를 다시 살펴보세요</p>
      </motion.div>

      {loading && (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="animate-spin text-3xl">💬</div>
          <p className="text-sm text-muted-foreground font-semibold">불러오는 중...</p>
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-bold text-foreground mb-1">대화 기록이 없어요</p>
          <p className="text-sm text-muted-foreground font-semibold">채팅에서 대화를 시작해 보세요</p>
          <Link to="/chat" className="duo-btn-primary inline-block mt-4 px-6 py-2 text-sm">
            대화 시작하기
          </Link>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session, idx) => {
            const isExpanded = expandedSession === session.session_id;
            return (
              <motion.div
                key={session.session_id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.03 }}
              >
                <button
                  onClick={() => setExpandedSession(isExpanded ? null : session.session_id)}
                  className="w-full text-left bg-card rounded-2xl border border-border p-4 shadow-sm hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <MessageSquare size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{session.first_message}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-0.5">
                            <Clock size={10} />
                            {format(new Date(session.last_message_at), "M월 d일 HH:mm", { locale: ko })}
                          </span>
                          <span className="text-[10px] text-primary font-bold">{session.message_count}개 메시지</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                </button>

                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="mt-1 bg-card rounded-2xl border border-border p-4 shadow-sm max-h-[60vh] overflow-y-auto space-y-3"
                  >
                    {session.messages.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                          msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          {msg.role === "assistant" ? (
                            <div className="prose prose-sm max-w-none text-foreground">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm font-semibold">{msg.content}</p>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground font-semibold mt-0.5 px-1">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default ChatHistoryPage;
