export const MOVES = ['rock', 'paper', 'scissors'] as const;
export type Move = (typeof MOVES)[number];

export type Outcome = 'win' | 'lose' | 'draw' | 'forfeit';

export type RoundResult = {
    moveA: Move;
    moveB: Move;
    winner: 'a' | 'b' | null;
};

export type MatchState = {
    targetRounds: number;
    scoreA: number;
    scoreB: number;
    forfeitedBy: 'a' | 'b' | null;
}

export type PlayedRound = {
    round: RoundResult;
    state: MatchState;
}