// Streak milestones. Points are awarded server-side by record_activity (SEC-4);
// this list only provides the badge and name shown to the user.
const MILESTONES = [
  { days: 1, points: 10, badge: "🌱", name: "첫 걸음" },
  { days: 3, points: 30, badge: "🔥", name: "불꽃 시작" },
  { days: 7, points: 100, badge: "⭐", name: "일주일 챔피언" },
  { days: 14, points: 250, badge: "💎", name: "2주 마스터" },
  { days: 30, points: 500, badge: "🏆", name: "한 달 전설" },
  { days: 60, points: 500, badge: "🌟", name: "두 달 영웅" },
  { days: 90, points: 500, badge: "👑", name: "세 달 왕" },
];

export const MILESTONE_LIST = MILESTONES;
