import { motion } from "framer-motion";
import { BarChart3, Type, AlignLeft, Brain, TrendingUp, Hash } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, type TooltipProps,
} from "recharts";

export type TextAnalysis = {
  wordFrequency: { word: string; count: number; percentage: number }[];
  sentenceStructures: { pattern: string; description: string; count: number; example: string }[];
  totalSentences: number;
  avgSentenceLength: number;
  vocabularyRichness: number;
  complexityScore: number;
  topBigrams: { phrase: string; count: number }[];
  summary: string;
};

type Props = {
  analysis: TextAnalysis;
  wordCount: number;
  uniqueWords: number;
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--duo-blue))",
  "hsl(var(--duo-orange))",
  "hsl(var(--duo-purple))",
  "hsl(var(--duo-red))",
  "hsl(var(--duo-yellow))",
  "hsl(var(--duo-green-dark))",
];

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border-2 border-border rounded-xl p-3 shadow-lg">
      <p className="font-bold text-foreground text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

const AnalysisDashboard = ({ analysis, wordCount, uniqueWords }: Props) => {
  const topWords = (analysis.wordFrequency || []).slice(0, 15);
  const structures = analysis.sentenceStructures || [];
  const bigrams = analysis.topBigrams || [];

  return (
    <div className="space-y-4 mt-6">
      {/* Summary */}
      {analysis.summary && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="duo-card">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-duo-purple" />
            <h3 className="font-bold text-foreground">AI 분석 요약</h3>
          </div>
          <p className="text-sm font-semibold text-muted-foreground leading-relaxed">{analysis.summary}</p>
        </motion.div>
      )}

      {/* Stats grid */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-3 gap-3">
        <div className="duo-card text-center py-3">
          <div className="text-xl font-extrabold text-primary">{wordCount.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground font-bold">총 단어</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="text-xl font-extrabold text-duo-blue">{uniqueWords.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground font-bold">고유 단어</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="text-xl font-extrabold text-duo-purple">{analysis.totalSentences}</div>
          <div className="text-[10px] text-muted-foreground font-bold">총 문장</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="text-xl font-extrabold text-duo-orange">{analysis.avgSentenceLength?.toFixed(1)}</div>
          <div className="text-[10px] text-muted-foreground font-bold">평균 문장 길이</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="text-xl font-extrabold text-primary">{analysis.vocabularyRichness}%</div>
          <div className="text-[10px] text-muted-foreground font-bold">어휘 다양성</div>
        </div>
        <div className="duo-card text-center py-3">
          <div className="text-xl font-extrabold text-duo-red">{analysis.complexityScore}/10</div>
          <div className="text-[10px] text-muted-foreground font-bold">복잡도</div>
        </div>
      </motion.div>

      {/* Word Frequency Chart */}
      {topWords.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="duo-card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-primary" />
            <h3 className="font-bold text-foreground">단어 사용 빈도 랭킹</h3>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(200, topWords.length * 28)}>
            <BarChart data={topWords} layout="vertical" margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                type="category"
                dataKey="word"
                tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--foreground))" }}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="사용 횟수" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Word Frequency Table */}
      {topWords.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="duo-card">
          <div className="flex items-center gap-2 mb-3">
            <Type size={18} className="text-duo-blue" />
            <h3 className="font-bold text-foreground">단어 랭킹 상세</h3>
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {topWords.map((w, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-xs font-extrabold text-muted-foreground w-6 text-right">
                  {i + 1}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{w.word}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(w.count / topWords[0].count) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-bold text-primary">{w.count}회</span>
                <span className="text-[10px] font-semibold text-muted-foreground">({w.percentage}%)</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sentence Structure Chart */}
      {structures.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="duo-card">
          <div className="flex items-center gap-2 mb-4">
            <AlignLeft size={18} className="text-duo-orange" />
            <h3 className="font-bold text-foreground">문장 구조 분석</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={structures}
                dataKey="count"
                nameKey="pattern"
                cx="50%"
                cy="50%"
                outerRadius={70}
                innerRadius={35}
                label={({ pattern, percent }) => `${pattern} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                fontSize={10}
                fontWeight={700}
              >
                {structures.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Structure details */}
          <div className="mt-3 space-y-2">
            {structures.map((s, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-muted/50">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-sm font-bold text-foreground">{s.pattern}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">{s.description}</span>
                  </div>
                  <span className="text-xs font-bold text-primary">{s.count}회</span>
                </div>
                {s.example && (
                  <p className="text-[11px] text-muted-foreground font-semibold pl-5 italic">
                    "{s.example}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Top Bigrams */}
      {bigrams.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="duo-card">
          <div className="flex items-center gap-2 mb-3">
            <Hash size={18} className="text-duo-purple" />
            <h3 className="font-bold text-foreground">자주 쓰는 표현 (2-gram)</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {bigrams.map((b, i) => (
              <div key={i} className="px-3 py-1.5 rounded-full bg-muted text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>{b.phrase}</span>
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{b.count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Future features placeholder */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="duo-card opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={18} className="text-muted-foreground" />
          <h3 className="font-bold text-muted-foreground">🔜 추후 추가 예정</h3>
        </div>
        <ul className="text-xs text-muted-foreground font-semibold space-y-1 list-disc pl-4">
          <li>학습자 활동 로그 (세션 길이, DAU/MAU, 레슨 완료율)</li>
          <li>성과 지표 (퀴즈 점수, 정확도, 단어/문법 습득률)</li>
          <li>시간 기반 데이터 (학습 시간, 복습 주기, 드롭아웃 시점)</li>
          <li>개인화 정보 (수준별 맞춤 추천)</li>
          <li>피드백 및 상호작용 (AI 응답 시간, 오류 패턴)</li>
        </ul>
      </motion.div>
    </div>
  );
};

export default AnalysisDashboard;
