import { Injectable } from "@nestjs/common";
import type { DB } from '../db/client';
import { InjectDb } from "../db/db.provider";
import { scores } from '../db/schema';
import { ScoreEntity } from "./score.entity";
import { desc, eq, count } from 'drizzle-orm';
import { type MatchOutcome } from "./score.constants";

export type ScoreCount = {
    gameId: string;
    outcome: MatchOutcome;
    total: number;
};
@Injectable()
export class ScoreRepository {
    constructor(@InjectDb() private readonly db: DB) {}

    async create(score: ScoreEntity): Promise<void> {
        await this.db.insert(scores).values({
            sessionId: score.sessionId,
            userId: score.userId,
            opponentId: score.opponentId,
            gameId: score.gameId,
            value: score.value,
            outcome: score.outcome,
            achievedAt: score.achievedAt,
        });
    }

    async findByUser(userId: string, limit: number, offset: number): Promise<ScoreEntity[]> {
        const rows = await this.db
            .select()
            .from(scores)
            .where(eq(scores.userId, userId))
            .orderBy(desc(scores.achievedAt), desc(scores.sessionId))
            .limit(limit)
            .offset(offset);

        return rows.map((row) => new ScoreEntity({
            sessionId: row.sessionId,
            userId: row.userId,
            opponentId: row.opponentId,
            gameId: row.gameId,
            value: row.value ?? 0,
            outcome: row.outcome,
            achievedAt: row.achievedAt,
        }));
    }

    async countByUser(userId: string): Promise<number> {
        const [row] = await this.db
            .select({ total: count() })
            .from(scores)
            .where(eq(scores.userId, userId));

        return row.total;
    }

    async countByGame(userId: string): Promise<ScoreCount[]> {
        const rows = await this.db
            .select({ 
                gameId: scores.gameId,
                outcome: scores.outcome,
                total: count(),
            })
            .from(scores)
            .where(eq(scores.userId, userId))
            .groupBy(scores.gameId, scores.outcome);

        return rows.map((row) => ({
            gameId: row.gameId,
            outcome: row.outcome,
            total: row.total,
        }));
    }
}