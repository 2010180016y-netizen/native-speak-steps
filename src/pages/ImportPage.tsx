import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ImportPage = () => {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ wordCount: number; uniqueWords: number } | null>(null);

  const analyzeText = (content: string) => {
    const words = content.trim().split(/\s+/).filter(Boolean);
    const unique = new Set(words);
    return { wordCount: words.length, uniqueWords: unique.size };
  };

  const handleAnalyze = async () => {
    if (!text.trim() || !user) return;
    setAnalyzing(true);

    try {
      const analysis = analyzeText(text);
      setResult(analysis);

      const { error } = await supabase.from("language_imports").insert({
        user_id: user.id,
        source_type: "text",
        content: text.slice(0, 5000),
        word_count: analysis.wordCount,
        unique_words: analysis.uniqueWords,
      });

      if (error) throw error;
      toast.success(`${analysis.wordCount}개 단어 분석 완료! 🎉`);
    } catch {
      toast.error("분석에 실패했습니다");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setText(content);
    };
    reader.readAsText(file);
  };

  return (
    <AppLayout>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-extrabold text-foreground mb-1">모국어 분석</h1>
        <p className="text-sm text-muted-foreground font-semibold mb-6">
          평소 쓰는 대화를 입력하면 학습량을 계산해 드려요
        </p>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="카카오톡 대화, 일기, 메모 등 평소에 쓰는 글을 붙여넣어 보세요..."
          className="w-full h-48 px-4 py-3 rounded-2xl border-2 border-border bg-card text-foreground font-semibold resize-none focus:border-primary focus:outline-none transition-colors"
        />

        <div className="flex gap-3 mt-4">
          <label className="flex-1 duo-card flex items-center justify-center gap-2 p-3 cursor-pointer hover:scale-[1.01] transition-transform">
            <FileText size={18} className="text-muted-foreground" />
            <span className="text-sm font-bold text-muted-foreground">파일 업로드</span>
            <input
              type="file"
              accept=".txt,.csv,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!text.trim() || analyzing}
          className="duo-btn-primary w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {analyzing ? (
            <><Loader2 size={20} className="animate-spin" /> 분석 중...</>
          ) : (
            <><Upload size={20} /> 분석하기</>
          )}
        </button>
      </motion.div>

      {result && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="duo-card mt-6"
        >
          <h3 className="font-bold text-foreground mb-4">📊 분석 결과</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl font-extrabold text-primary">{result.wordCount.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-semibold mt-1">총 단어 수</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-extrabold text-duo-blue">{result.uniqueWords.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-semibold mt-1">고유 단어 수</div>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-primary/10">
            <p className="text-sm font-semibold text-foreground">
              💡 당신은 약 <strong>{result.uniqueWords}</strong>개의 고유 단어를 사용해요.
              같은 수준으로 외국어를 배우면 일상 대화가 가능합니다!
            </p>
          </div>
        </motion.div>
      )}
    </AppLayout>
  );
};

export default ImportPage;
