import { type MatchOutcome } from '../../scores';

export type Player = 'a' | 'b';

export type Outcome = MatchOutcome

export const MATCH_MODES = ['fixed-target-score', 'fixed-rounds'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];
export const POWER_UPS = ['shield', 'double'] as const;
export type PowerUp = (typeof POWER_UPS)[number];

export type MatchState = {
    target: number;
    scoreA: number;
    scoreB: number;
    forfeitedBy: Player | null;
    roundsPlayed: number;
    mode: MatchMode;
    powerUps: boolean;
    powerUpsLeft: Record<Player, PowerUp[]>;
}
