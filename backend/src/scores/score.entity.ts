import { type MatchOutcome } from "./score.constants";

export type ScoreAttributes = {
    sessionId: string;
    userId: string;
    opponentId: string | null;
    gameId: string;
    value: number;
    outcome: MatchOutcome;
    achievedAt: Date;
};

export class ScoreEntity {
    sessionId: string;
    userId: string;
    opponentId: string | null;
    gameId: string;
    value: number;
    outcome: MatchOutcome;
    achievedAt: Date;

    constructor(attrs: ScoreAttributes) {
        this.sessionId = attrs.sessionId;
        this.userId = attrs.userId;
        this.opponentId = attrs.opponentId;
        this.gameId = attrs.gameId;
        this.value = attrs.value;
        this.outcome = attrs.outcome;
        this.achievedAt = attrs.achievedAt;
    }

    toPublicData() {
        return {
            sessionId: this.sessionId, 
            userId: this.userId, 
            gameId: this.gameId, 
            value: this.value, 
            outcome: this.outcome, 
            achievedAt: this.achievedAt,
        };
    }
}
