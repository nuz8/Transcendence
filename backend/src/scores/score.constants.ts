export const MATCH_OUTCOMES = ['win', 'lose', 'draw', 'forfeit'] as const;

export type MatchOutcome = (typeof MATCH_OUTCOMES)[number];