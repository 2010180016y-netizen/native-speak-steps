// Speaking-specific missions and level-based hints

export type SpeakingMission = {
  id: string;
  title: string;
  xpReward: number;
  checkType: "message_count" | "question_count" | "word_count" | "duration";
  threshold: number;
};

export const SPEAKING_MISSIONS: Record<string, SpeakingMission[]> = {
  cafe: [
    { id: "cafe_order", title: "음료를 주문해 보세요", xpReward: 10, checkType: "message_count", threshold: 2 },
    { id: "cafe_question", title: "메뉴에 대해 질문하기", xpReward: 15, checkType: "question_count", threshold: 1 },
    { id: "cafe_5msg", title: "5문장 이상 대화하기", xpReward: 20, checkType: "message_count", threshold: 5 },
  ],
  restaurant: [
    { id: "rest_reserve", title: "예약 요청하기", xpReward: 10, checkType: "message_count", threshold: 2 },
    { id: "rest_question", title: "메뉴 추천 요청하기", xpReward: 15, checkType: "question_count", threshold: 1 },
    { id: "rest_5msg", title: "5문장 이상 대화하기", xpReward: 20, checkType: "message_count", threshold: 5 },
  ],
  business_meeting: [
    { id: "biz_intro", title: "자기소개하기", xpReward: 10, checkType: "message_count", threshold: 1 },
    { id: "biz_opinion", title: "의견 제시하기", xpReward: 15, checkType: "message_count", threshold: 3 },
    { id: "biz_question", title: "질문 2개 하기", xpReward: 20, checkType: "question_count", threshold: 2 },
  ],
  job_interview: [
    { id: "job_answer", title: "질문에 답변하기", xpReward: 10, checkType: "message_count", threshold: 2 },
    { id: "job_question", title: "면접관에게 질문하기", xpReward: 15, checkType: "question_count", threshold: 1 },
    { id: "job_long", title: "7문장 이상 대화하기", xpReward: 25, checkType: "message_count", threshold: 7 },
  ],
  blind_date: [
    { id: "date_intro", title: "자기소개하기", xpReward: 10, checkType: "message_count", threshold: 1 },
    { id: "date_question", title: "상대에 대해 질문하기", xpReward: 15, checkType: "question_count", threshold: 2 },
    { id: "date_5msg", title: "5문장 이상 대화하기", xpReward: 20, checkType: "message_count", threshold: 5 },
  ],
  airport: [
    { id: "air_checkin", title: "체크인 요청하기", xpReward: 10, checkType: "message_count", threshold: 2 },
    { id: "air_question", title: "게이트/시간 질문하기", xpReward: 15, checkType: "question_count", threshold: 1 },
    { id: "air_5msg", title: "5문장 이상 대화하기", xpReward: 20, checkType: "message_count", threshold: 5 },
  ],
  hotel: [
    { id: "hotel_checkin", title: "체크인 하기", xpReward: 10, checkType: "message_count", threshold: 2 },
    { id: "hotel_request", title: "추가 요청하기", xpReward: 15, checkType: "message_count", threshold: 3 },
    { id: "hotel_5msg", title: "5문장 이상 대화하기", xpReward: 20, checkType: "message_count", threshold: 5 },
  ],
  shopping: [
    { id: "shop_ask", title: "사이즈/가격 물어보기", xpReward: 10, checkType: "question_count", threshold: 1 },
    { id: "shop_decide", title: "구매 결정 말하기", xpReward: 15, checkType: "message_count", threshold: 3 },
    { id: "shop_5msg", title: "5문장 이상 대화하기", xpReward: 20, checkType: "message_count", threshold: 5 },
  ],
  phone_call: [
    { id: "phone_purpose", title: "통화 목적 말하기", xpReward: 10, checkType: "message_count", threshold: 1 },
    { id: "phone_question", title: "질문 2개 하기", xpReward: 15, checkType: "question_count", threshold: 2 },
    { id: "phone_5msg", title: "5문장 이상 대화하기", xpReward: 20, checkType: "message_count", threshold: 5 },
  ],
  free: [
    { id: "free_3msg", title: "3문장 이상 대화하기", xpReward: 10, checkType: "message_count", threshold: 3 },
    { id: "free_question", title: "질문 2개 하기", xpReward: 15, checkType: "question_count", threshold: 2 },
    { id: "free_7msg", title: "7문장 이상 대화하기", xpReward: 25, checkType: "message_count", threshold: 7 },
  ],
};

// Level-based hint phrases per language
export const SPEAKING_HINTS: Record<string, Record<string, string[]>> = {
  en: {
    beginner: [
      "Hello, how are you?",
      "Can I have a...?",
      "How much is this?",
      "Where is the...?",
      "Thank you very much!",
    ],
    elementary: [
      "I'd like to order...",
      "Could you recommend something?",
      "What time does it open?",
      "I'm looking for...",
    ],
    intermediate: [
      "I was wondering if...",
      "Would you mind if I...?",
      "That sounds great, but...",
    ],
    advanced: [],
  },
  ja: {
    beginner: [
      "すみません、これをお願いします",
      "いくらですか？",
      "ありがとうございます",
      "〜はどこですか？",
      "はい、そうです",
    ],
    elementary: [
      "〜をお願いしてもいいですか？",
      "おすすめは何ですか？",
      "何時に開きますか？",
    ],
    intermediate: [
      "〜について教えていただけますか？",
      "もしよろしければ...",
    ],
    advanced: [],
  },
  ko: {
    beginner: [
      "안녕하세요, 처음 뵙겠습니다",
      "이것 주세요",
      "얼마예요?",
      "어디에 있어요?",
      "감사합니다",
    ],
    elementary: [
      "추천해 주실 수 있나요?",
      "몇 시에 열어요?",
      "~을/를 찾고 있어요",
    ],
    intermediate: [
      "혹시 ~할 수 있을까요?",
      "그렇군요, 그런데...",
    ],
    advanced: [],
  },
  zh: {
    beginner: [
      "你好，请问...",
      "我要一个...",
      "多少钱？",
      "在哪里？",
      "谢谢！",
    ],
    elementary: [
      "可以推荐一下吗？",
      "几点开门？",
      "我在找...",
    ],
    intermediate: [
      "请问可以...吗？",
      "我想了解一下...",
    ],
    advanced: [],
  },
  es: {
    beginner: [
      "Hola, ¿cómo estás?",
      "¿Puedo tener un...?",
      "¿Cuánto cuesta?",
      "¿Dónde está...?",
      "¡Muchas gracias!",
    ],
    elementary: [
      "Me gustaría pedir...",
      "¿Podría recomendar algo?",
      "¿A qué hora abre?",
    ],
    intermediate: [],
    advanced: [],
  },
  fr: {
    beginner: [
      "Bonjour, comment allez-vous ?",
      "Je voudrais un...",
      "Combien ça coûte ?",
      "Où est le/la... ?",
      "Merci beaucoup !",
    ],
    elementary: [
      "Je voudrais commander...",
      "Pouvez-vous recommander ?",
      "À quelle heure ça ouvre ?",
    ],
    intermediate: [],
    advanced: [],
  },
  de: {
    beginner: [
      "Hallo, wie geht es Ihnen?",
      "Kann ich bitte ein...?",
      "Wie viel kostet das?",
      "Wo ist...?",
      "Vielen Dank!",
    ],
    elementary: [
      "Ich möchte bestellen...",
      "Können Sie etwas empfehlen?",
      "Wann öffnet es?",
    ],
    intermediate: [],
    advanced: [],
  },
};
