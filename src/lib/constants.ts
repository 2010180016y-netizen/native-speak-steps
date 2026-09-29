// Shared constants used across the app

export const LANGUAGES = [
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
] as const;

export const LANG_NAMES: Record<string, string> = {
  ko: "한국어", en: "English", ja: "日本語", zh: "中文",
  es: "Español", fr: "Français", de: "Deutsch", pt: "Português",
};

export const LEVEL_NAMES: Record<string, string> = {
  beginner: "🌱 초보자",
  elementary: "🌿 초급",
  intermediate: "🌳 중급",
  advanced: "🏔️ 고급",
};

export const LEVELS = [
  { value: "beginner", label: "초보자", emoji: "🌱", desc: "기초부터 시작" },
  { value: "elementary", label: "초급", emoji: "🌿", desc: "간단한 표현 가능" },
  { value: "intermediate", label: "중급", emoji: "🌳", desc: "일상 대화 가능" },
  { value: "advanced", label: "고급", emoji: "🏔️", desc: "복잡한 주제도 OK" },
];

/** BCP-47 language codes for Web Speech API */
export const SPEECH_LANG_MAP: Record<string, string> = {
  ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN",
  es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-BR",
};

export const OCCUPATIONS = [
  "학생", "회사원", "프리랜서", "의사", "엔지니어", "교사",
  "예술가", "요리사", "변호사", "기자", "디자이너", "CEO",
];

export const PERSONALITIES = [
  "유머러스한 😄", "차분한 😌", "에너지 넘치는 ⚡", "다정한 💕",
  "지적인 🧠", "솔직한 💬", "낙천적인 🌞", "신비로운 🔮",
];

export const SCENARIOS = [
  { id: "cafe", emoji: "☕", label: "카페 주문", description: "커피숍에서 음료 주문하기" },
  { id: "restaurant", emoji: "🍽️", label: "레스토랑", description: "레스토랑에서 식사 주문하기" },
  { id: "business_meeting", emoji: "💼", label: "비즈니스 미팅", description: "회의에서 프레젠테이션 및 토론" },
  { id: "job_interview", emoji: "🤝", label: "취업 면접", description: "면접관과 질의응답" },
  { id: "blind_date", emoji: "💕", label: "소개팅", description: "처음 만난 사람과 자연스럽게 대화" },
  { id: "airport", emoji: "✈️", label: "공항 / 여행", description: "체크인, 탑승, 길 묻기" },
  { id: "hotel", emoji: "🏨", label: "호텔 체크인", description: "예약 확인 및 체크인/아웃" },
  { id: "shopping", emoji: "🛍️", label: "쇼핑", description: "옷 가게에서 사이즈, 가격 묻기" },
  { id: "phone_call", emoji: "📞", label: "전화 통화", description: "전화로 예약하거나 문의하기" },
  { id: "free", emoji: "✨", label: "자유 대화", description: "주제 제한 없이 자유롭게 대화" },
] as const;

export const RANDOM_NAMES: Record<string, { male: string[]; female: string[] }> = {
  en: { male: ["James", "Oliver", "Ethan", "Liam", "Noah", "Lucas", "Mason", "Logan"], female: ["Emma", "Sophia", "Olivia", "Ava", "Mia", "Isabella", "Charlotte", "Amelia"] },
  ja: { male: ["太郎", "健太", "翔太", "大輝", "蓮", "悠真", "陽斗", "颯太"], female: ["花子", "美咲", "さくら", "結衣", "陽菜", "凛", "楓", "芽依"] },
  zh: { male: ["伟明", "浩然", "子轩", "明辉", "志强", "建国", "天宇", "俊杰"], female: ["美玲", "小红", "雨萱", "紫涵", "欣怡", "思琪", "语嫣", "梦洁"] },
  ko: { male: ["민준", "서준", "예준", "도윤", "시우", "주원", "하준", "지호"], female: ["서연", "서윤", "지우", "하은", "하윤", "민서", "지유", "채원"] },
  es: { male: ["Carlos", "Miguel", "Diego", "Alejandro", "Pablo", "Javier", "Luis", "Mateo"], female: ["María", "Sofía", "Valentina", "Lucía", "Isabella", "Camila", "Elena", "Paula"] },
  fr: { male: ["Lucas", "Hugo", "Louis", "Gabriel", "Raphaël", "Arthur", "Léo", "Jules"], female: ["Emma", "Jade", "Louise", "Alice", "Chloé", "Léa", "Manon", "Inès"] },
  de: { male: ["Felix", "Leon", "Paul", "Lukas", "Maximilian", "Elias", "Noah", "Ben"], female: ["Emma", "Mia", "Hannah", "Sophia", "Lina", "Emilia", "Ella", "Marie"] },
};

export const getRandomName = (lang: string, gender: "male" | "female") => {
  const names = RANDOM_NAMES[lang] || RANDOM_NAMES.en;
  const list = names[gender];
  return list[Math.floor(Math.random() * list.length)];
};
