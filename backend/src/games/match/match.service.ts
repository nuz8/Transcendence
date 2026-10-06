import { Injectable } from '@nestjs/common';
import { POWER_UPS, type MatchState, type Outcome, type Player, type MatchMode, type PowerUp } from './match.types';

@Injectable()
export class MatchService {
    createMatch(target: number, mode: MatchMode, powerUps = false): MatchState {
        if (!Number.isInteger(target) || target <= 0) {
            throw new Error('Target must be a positive integer! (at least 1)');
        }
        return {
            target,
            scoreA: 0,
            scoreB: 0,
            forfeitedBy: null,
            roundsPlayed: 0,
            mode,
            powerUps,
            powerUpsLeft: {
                a: powerUps ? [...POWER_UPS] : [],
                b: powerUps ? [...POWER_UPS] : [],
            },
        };
    }

    recordRound(state: MatchState, winner: Player | null, played: Partial<Record<Player, PowerUp>> = {}): MatchState {
        const shielded = played.a === 'shield' || played.b === 'shield';
        const scorer = shielded ? null : winner;
        const points = scorer && played[scorer] === 'double' ? 2 : 1;
        
        return {
            ...state,
            scoreA: state.scoreA + (scorer === 'a' ? points : 0),
            scoreB: state.scoreB + (scorer === 'b' ? points : 0),
            roundsPlayed: state.roundsPlayed + 1,
            powerUpsLeft: {
                a: state.powerUpsLeft.a.filter((powerUp) => powerUp !== played.a),
                b: state.powerUpsLeft.b.filter((powerUp) => powerUp !== played.b),
            },
        };
    }

    forfeit(state: MatchState, player: Player): MatchState {
        return {
            ...state,
            forfeitedBy: player,
        };
    }

    gameOver(state: MatchState): boolean {
        if (state.forfeitedBy !== null || this.matchWinner(state) !== null)
            return true;
        return state.mode === 'fixed-rounds' && state.roundsPlayed >= state.target;
    }

    matchWinner(state: MatchState): 'a' | 'b' | null {
        if (state.forfeitedBy === 'a') return 'b';
        if (state.forfeitedBy === 'b') return 'a';
        if (state.mode === 'fixed-target-score') {
            if (state.scoreA >= state.target) return 'a';
            if (state.scoreB >= state.target) return 'b';
            return null;
        }
        const roundsLeft = state.target - state.roundsPlayed;
        if (state.scoreA > state.scoreB + this.mostPointsLeft(state, 'b', roundsLeft)) return 'a';
        if (state.scoreB > state.scoreA + this.mostPointsLeft(state, 'a', roundsLeft)) return 'b';
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

    private mostPointsLeft(state: MatchState, player: Player, roundsLeft: number): number {
        if(roundsLeft <= 0)
            return 0;

        return roundsLeft + (state.powerUpsLeft[player].includes('double') ? 1 : 0);
    }
}
