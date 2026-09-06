import { Injectable } from '@nestjs/common';
import { MOVES, type MatchState, type PlayedRound, type Move, type Outcome, type RoundResult } from './rps.types';
import { randomInt } from 'node:crypto';

const BEATS: Record<Move, Move> = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
};

@Injectable()
export class RpsService {

    play(moveA: Move, moveB: Move): RoundResult {
        if (moveA === moveB)
            return {
                moveA,
                moveB,
                winner: null
            };

        return {
            moveA,
            moveB,
            winner: BEATS[moveA] === moveB ? 'a' : 'b'
        };
    }

    outcomeFor(player: 'a' | 'b', result: RoundResult): Outcome {
        if (result.winner === null)
            return 'draw';
        return result.winner === player ? 'win' : 'lose';
    }

    randomMove(): Move {
        return MOVES[randomInt(MOVES.length)];
    }

    parseMove(input: string): Move | null {
        const s = input.trim().toLowerCase();
        return MOVES.find((m) => m === s || m[0] === s) ?? null; 
    }

    createMatch(bestOf = 3): MatchState {
        if (bestOf < 1 || bestOf % 2 === 0){
            throw new Error('bestOf must be an odd number!');
        }
        return {
            targetRounds: (bestOf + 1) / 2,
            scoreA: 0,
            scoreB: 0,
            forfeitedBy: null,
        };
    }

    playRound(state: MatchState, moveA: Move, moveB: Move): PlayedRound {
        const round = this.play(moveA, moveB);

        const next: MatchState = {
            ...state,
            scoreA: state.scoreA + (round.winner === 'a' ? 1 : 0),
            scoreB: state.scoreB + (round.winner === 'b' ? 1 : 0),
        };
        return { round, state: next };
    }

    forfeit(state: MatchState, player: 'a' | 'b'): MatchState {
        return {
            ...state,
            forfeitedBy: player,
        };
    }

    gameOver(state: MatchState): boolean {
        return this.matchWinner(state) !== null  || state.forfeitedBy !== null;
    }

    matchWinner(state: MatchState): 'a' | 'b' | null {
        if (state.forfeitedBy === 'a') return 'b';
        if (state.forfeitedBy === 'b') return 'a';
        if (state.scoreA >= state.targetRounds) return 'a';
        else if (state.scoreB >= state.targetRounds) return 'b';
        return null;
    }

    matchOutcome(player: 'a' | 'b', state: MatchState): Outcome {
        if (state.forfeitedBy === player)
            return 'forfeit';
        return this.matchWinner(state) === player ? 'win' : 'lose';
    }
}
