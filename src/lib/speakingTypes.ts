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
  overallScore?: number;
  grammar?: {
    score?: number;
    errors?: Array<{ original: string; corrected: string; explanation?: string }>;
  };
  pronunciation?: { score?: number; feedback?: string };
  vocabulary?: { score?: number; feedback?: string };
  fluency?: { score?: number; feedback?: string };
  summary?: string;
  strengths?: string[];
  improvements?: string[];
}
