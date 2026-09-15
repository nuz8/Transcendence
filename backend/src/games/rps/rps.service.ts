import { Injectable } from '@nestjs/common';
import { MOVES, type MatchState, type PlayedRound, type Move, type Outcome, type Player, type RoundResult } from './rps.types';
import { randomInt } from 'node:crypto';
import { MatchService } from '../match/match.service';

const BEATS: Record<Move, Move> = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
};

@Injectable()
export class RpsService {

    constructor (private readonly matchService: MatchService) {}

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

    outcomeFor(player: Player, result: RoundResult): Outcome {
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

    playRound(state: MatchState, moveA: Move, moveB: Move): PlayedRound {
        const round = this.play(moveA, moveB);

        return { round, state: this.matchService.recordRound(state, round.winner) };
    }
}
