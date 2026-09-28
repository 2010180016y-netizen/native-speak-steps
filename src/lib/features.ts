/**
 * Product scope switches (D1 — see docs/decisions/D1-scope.md).
 * Frozen features are hidden from navigation and routes; their code stays in
 * place until it is deleted (PLT-1) or the feature is re-enabled here.
 */
export const FEATURES = {
  pets: false,
  leaderboard: false,
  aiRecommendations: false,
  aiWeeklyReport: false,
  extendedStats: false,
} as const;
