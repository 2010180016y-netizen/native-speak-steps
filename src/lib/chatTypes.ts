// Shared types for chat feature
import type { PracticeCard } from "@/lib/phrasePractice";

export type ChatCorrection = {
  wrong: string;
  correct: string;
  explanation: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  responseTimeMs?: number;
  feedbackId?: string;
  rating?: -1 | 1 | null;
  corrections?: ChatCorrection[];
};

export type ChatPhase = "setup" | "chat" | "feedback";

export interface SavedChatSession {
  sessionId: string;
  persona: import("@/components/chat/ChatSetup").Persona;
  scenario: import("@/components/chat/ChatSetup").ChatScenario;
  messages: ChatMessage[];
  // Missing in sessions saved before these were kept; a resumed session then picks new cards.
  practiceCards?: PracticeCard[];
  completedMissions?: string[];
}

export const CHAT_SESSION_KEY = "chat_active_session";
