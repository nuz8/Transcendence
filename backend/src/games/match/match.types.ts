import { type MatchOutcome } from '../../scores';

export type Player = 'a' | 'b';

export type Outcome = MatchOutcome

export const MATCH_MODES = ['first-to', 'best-of'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export type MatchState = {
    targetRounds: number;
    scoreA: number;
    scoreB: number;
    forfeitedBy: Player | null;
}