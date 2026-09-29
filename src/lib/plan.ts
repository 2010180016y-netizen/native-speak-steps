// BIZ-1 plans. Display values only: create-order sets the real price and
// supabase/functions/_shared/ai.ts (DAILY_LIMITS) enforces the real limits.
export const PRO_PRICE_KRW = 4900;
export const PRO_DAYS = 30;

export const PLAN_LIMITS = [
  { label: "AI 대화·스피킹", free: "각 30회/일", pro: "각 200회/일" },
  { label: "모국어 분석", free: "3회/일", pro: "20회/일" },
  { label: "대화 피드백", free: "3회/일", pro: "30회/일" },
  { label: "카드 생성", free: "10회/일", pro: "40회/일" },
];

export const isPro = (profile: { pro_until: string | null } | null, now = new Date()) =>
  Boolean(profile?.pro_until && new Date(profile.pro_until) > now);
