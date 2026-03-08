// Starter prompts and mini missions for each chat scenario

export const SCENARIO_STARTERS: Record<string, string[]> = {
  cafe: [
    "Hi, could I get a latte please?",
    "What's your most popular drink?",
    "Do you have any seasonal specials?",
  ],
  restaurant: [
    "Table for two, please.",
    "Could I see the menu?",
    "What do you recommend here?",
  ],
  business_meeting: [
    "Let me share the quarterly results.",
    "I have a proposal I'd like to discuss.",
    "What are your thoughts on the new strategy?",
  ],
  job_interview: [
    "Thank you for having me today.",
    "I'd love to tell you about my experience.",
    "What does a typical day look like in this role?",
  ],
  blind_date: [
    "Nice to meet you! How was your day?",
    "So, what do you do for fun?",
    "Have you been to this place before?",
  ],
  school: [
    "Did you finish the homework?",
    "What clubs are you in?",
    "Want to study together for the exam?",
  ],
  airport: [
    "Excuse me, where is Gate 12?",
    "I'd like to check in for my flight.",
    "Is there a delay on Flight 205?",
  ],
  hotel: [
    "I have a reservation under my name.",
    "Could I get a room with a view?",
    "What time is checkout?",
  ],
  shopping: [
    "Do you have this in a medium?",
    "How much is this jacket?",
    "Can I try this on?",
  ],
  hospital: [
    "I've had a headache for three days.",
    "I'd like to make an appointment.",
    "Is the doctor available today?",
  ],
  phone_call: [
    "Hi, I'm calling to make a reservation.",
    "Could I speak to the manager, please?",
    "I'm calling about my order.",
  ],
  neighbor: [
    "Hi! I just moved in next door.",
    "Your garden looks beautiful!",
    "Is there a good grocery store nearby?",
  ],
  taxi: [
    "Could you take me to the train station?",
    "How long will it take to get there?",
    "Can you drop me off at the corner?",
  ],
  bank: [
    "I'd like to open a savings account.",
    "Can I transfer money to another bank?",
    "What's the interest rate on this account?",
  ],
  gym: [
    "I'd like to sign up for a membership.",
    "Can you recommend a workout routine?",
    "How do I use this machine?",
  ],
  party: [
    "Hey! Great party, right?",
    "How do you know the host?",
    "What do you do for a living?",
  ],
  complaint: [
    "I received the wrong order.",
    "The product I bought isn't working properly.",
    "I'd like to speak with a manager about this.",
  ],
  roommate: [
    "Should we set some house rules?",
    "Whose turn is it to clean this week?",
    "Mind if I have a friend over tonight?",
  ],
  dating_app: [
    "Hey! Your profile caught my eye 😊",
    "What kind of music are you into?",
    "Seen any good movies lately?",
  ],
  presentation: [
    "Great presentation! I had a question about slide 5.",
    "Could you elaborate on the budget projections?",
    "How does this compare to last year's results?",
  ],
  cooking: [
    "What are we making today?",
    "How much salt should I add?",
    "Is there a vegetarian alternative?",
  ],
  emergency: [
    "Excuse me, I'm lost. Can you help me?",
    "I need to find the nearest hospital.",
    "I lost my wallet. What should I do?",
  ],
  free: [
    "Hi! How's your day going?",
    "What's something interesting that happened to you recently?",
    "If you could travel anywhere, where would you go?",
  ],
};

export interface MiniMission {
  id: string;
  title: string;
  description: string;
  checkKeywords: string[]; // keywords to detect mission completion
  xpReward: number;
}

export const SCENARIO_MISSIONS: Record<string, MiniMission[]> = {
  cafe: [
    { id: "cafe_order", title: "음료 주문 완료", description: "음료를 주문하고 사이즈를 선택하세요", checkKeywords: ["large", "medium", "small", "grande", "venti", "size", "latte", "coffee", "order"], xpReward: 15 },
    { id: "cafe_customize", title: "커스텀 주문", description: "우유 종류나 추가 옵션을 요청하세요", checkKeywords: ["oat", "soy", "almond", "extra", "shot", "syrup", "milk", "cream", "sugar"], xpReward: 20 },
  ],
  restaurant: [
    { id: "rest_recommend", title: "추천 요청", description: "추천 메뉴를 물어보세요", checkKeywords: ["recommend", "suggestion", "popular", "best", "favorite", "special"], xpReward: 15 },
    { id: "rest_allergy", title: "알레르기 확인", description: "알레르기나 식이 제한을 설명하세요", checkKeywords: ["allergy", "allergic", "vegetarian", "vegan", "gluten", "nut", "dairy"], xpReward: 20 },
  ],
  business_meeting: [
    { id: "biz_opinion", title: "의견 제시", description: "자신의 의견을 논리적으로 제시하세요", checkKeywords: ["I think", "in my opinion", "I believe", "suggest", "propose", "idea"], xpReward: 20 },
    { id: "biz_agree", title: "동의/반대 표현", description: "상대 의견에 동의하거나 정중히 반대하세요", checkKeywords: ["agree", "disagree", "good point", "however", "but", "on the other hand"], xpReward: 20 },
  ],
  job_interview: [
    { id: "job_strength", title: "강점 어필", description: "자신의 강점이나 경험을 어필하세요", checkKeywords: ["experience", "strength", "skill", "achievement", "accomplished", "responsible"], xpReward: 20 },
    { id: "job_question", title: "질문하기", description: "면접관에게 회사에 대해 질문하세요", checkKeywords: ["what", "how", "could you tell", "culture", "team", "growth", "opportunity"], xpReward: 15 },
  ],
  blind_date: [
    { id: "date_hobby", title: "취미 공유", description: "서로의 취미에 대해 이야기하세요", checkKeywords: ["hobby", "like to", "enjoy", "free time", "weekend", "fun", "interest"], xpReward: 15 },
    { id: "date_compliment", title: "칭찬하기", description: "상대방에게 자연스럽게 칭찬하세요", checkKeywords: ["nice", "great", "love", "amazing", "beautiful", "cool", "awesome", "interesting"], xpReward: 15 },
  ],
  shopping: [
    { id: "shop_bargain", title: "가격 흥정", description: "가격에 대해 물어보거나 할인을 요청하세요", checkKeywords: ["discount", "price", "cheaper", "sale", "deal", "how much", "cost"], xpReward: 20 },
    { id: "shop_return", title: "교환/환불 요청", description: "교환이나 환불 정책을 물어보세요", checkKeywords: ["return", "exchange", "refund", "receipt", "policy", "change"], xpReward: 20 },
  ],
  hospital: [
    { id: "hosp_symptom", title: "증상 설명", description: "증상을 구체적으로 설명하세요", checkKeywords: ["pain", "hurt", "fever", "headache", "stomach", "cough", "symptom", "feel"], xpReward: 20 },
    { id: "hosp_appt", title: "예약 잡기", description: "진료 예약을 잡으세요", checkKeywords: ["appointment", "schedule", "available", "tomorrow", "next week", "book", "reserve"], xpReward: 15 },
  ],
  free: [
    { id: "free_opinion", title: "의견 나누기", description: "어떤 주제에 대해 의견을 나눠보세요", checkKeywords: ["think", "opinion", "believe", "feel", "perspective", "agree"], xpReward: 15 },
    { id: "free_question", title: "3가지 질문하기", description: "상대에게 최소 3가지 질문을 해보세요", checkKeywords: ["?"], xpReward: 20 },
  ],
};

// Default missions for scenarios without specific ones
export const DEFAULT_MISSIONS: MiniMission[] = [
  { id: "default_5msg", title: "대화 5회 달성", description: "5개 이상의 메시지를 보내세요", checkKeywords: [], xpReward: 15 },
  { id: "default_question", title: "질문 2개 하기", description: "상대에게 질문을 2번 이상 하세요", checkKeywords: ["?"], xpReward: 15 },
];
