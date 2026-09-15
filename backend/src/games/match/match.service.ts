import { Injectable } from '@nestjs/common';
import type { MatchState, Outcome, Player } from './match.types';

@Injectable()
export class MatchService {
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

    recordRound(state: MatchState, winner: Player | null): MatchState {
        return {
            ...state,
            scoreA: state.scoreA + (winner === 'a' ? 1 : 0),
            scoreB: state.scoreB + (winner === 'b' ? 1 : 0),
        };
    }

    forfeit(state: MatchState, player: Player): MatchState {
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

    matchOutcome(player: Player, state: MatchState): Outcome {
        if (state.forfeitedBy === player)
            return 'forfeit';

        const winner = this.matchWinner(state);
        if (winner === null)
            return 'draw';

        return winner === player ? 'win' : 'lose';
    }
    
}