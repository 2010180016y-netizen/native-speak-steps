export type Correction = {
  wrong: string;
  correct: string;
  explanation: string;
};

export type SpeakingMessage = {
  role: "user" | "assistant";
  content: string;
  corrections?: Correction[];
};

export type SpeakingPhase = "setup" | "incoming" | "call" | "feedback";

export interface SpeakingFeedbackData {
  overallScore: number;
  grammar: { score: number; errors: { original: string; corrected: string; explanation: string }[] };
  pronunciation: { score: number; comments: string[] };
  vocabulary: { score: number; comments: string[]; newWordsUsed: string[] };
  fluency: { score: number; comments: string[] };
  tips: string[];
  summary?: string;
  strengths?: string[];
  improvements?: string[];
}
