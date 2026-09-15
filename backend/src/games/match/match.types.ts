import { type MatchOutcome } from '../../scores';

export type Player = 'a' | 'b';

export type Outcome = MatchOutcome

export type MatchState = {
    targetRounds: number;
    scoreA: number;
    scoreB: number;
    forfeitedBy: Player | null;
}