export const MATCH_OUTCOMES = ['win', 'lose', 'draw', 'forfeit'] as const;

export type MatchOutcome = (typeof MATCH_OUTCOMES)[number];

export const XP_BY_OUTCOME: Record<MatchOutcome, number> = {
    win: 10,
    lose: 5,
    draw: 5, //not yet possible to draw in a match
    forfeit: 0,
};