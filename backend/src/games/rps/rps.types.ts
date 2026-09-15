import type { MatchState, Player } from '../match/match.types';

export const MOVES = ['rock', 'paper', 'scissors'] as const;
export type Move = (typeof MOVES)[number];

export type RoundResult = {
    moveA: Move;
    moveB: Move;
    winner: Player | null;
};

export type PlayedRound = {
    round: RoundResult;
    state: MatchState;
}

export type { MatchState, Outcome, Player } from '../match/match.types';