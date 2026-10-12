import { Injectable } from "@nestjs/common";
import type { DB } from '../db/client';
import { InjectDb } from "../db/db.provider";
import { scores, users } from '../db/schema';
import { ScoreEntity } from "./score.entity";
import { desc, eq, count, sql, isNull, and } from 'drizzle-orm';
import { type MatchOutcome } from "./score.constants";
import { AVATAR_CONSTANTS } from '../users/user.constants';

export type ScoreCount = {
    gameId: string;
    outcome: MatchOutcome;
    total: number;
};

export type ScoreWithXp = {
    score: ScoreEntity;
    xp: number;
};

export type ScoreWithOpponent = {
    score: ScoreEntity;
    opponent: {
        id: string | null;
        username: string;
        avatar: string;
        isDeleted: boolean;
    };
};

@Injectable()
export class ScoreRepository {
    constructor(@InjectDb() private readonly db: DB) {}

    async recordMatch(results: ScoreWithXp[]): Promise<void> {
        if (results.length === 0)
            return ;

        await this.db.transaction(async (tx) => {
           await tx.insert(scores).values(results.map(({ score }) => ({
                sessionId: score.sessionId,
                userId: score.userId,
                opponentId: score.opponentId,
                gameId: score.gameId,
                value: score.value,
                outcome: score.outcome as MatchOutcome,
                achievedAt: score.achievedAt,
           })));

           for (const { score, xp } of results) {
                if (xp === 0)
                    continue ;
                await tx.update(users).set({ xp: sql`${users.xp} + ${xp}` }).where(eq(users.id, score.userId));
           }
        });
    }

    async findByUser(
        userId: string,
        limit: number,
        offset: number
    ): Promise<ScoreWithOpponent[]> {
        const rows = await this.db
            .select({
                sessionId: scores.sessionId,
                opponentId: scores.opponentId,
                gameId: scores.gameId,
                value: scores.value,
                outcome: scores.outcome,
                achievedAt: scores.achievedAt,
                opponentUsername: users.username,
                opponentAvatar: users.avatar,
                opponentDeletedAt: users.deletedAt,
            })
            .from(scores)
            .leftJoin(users, eq(users.id, scores.opponentId))
            .where(eq(scores.userId, userId))
            .orderBy(desc(scores.achievedAt), desc(scores.sessionId))
            .limit(limit)
            .offset(offset);

        return rows.map((row) => {
            let opponent = null;
            if (row.opponentId === null) {
                opponent = {
                    id: null,
                    username: 'Bot',
                    avatar: AVATAR_CONSTANTS.BOT_AVATAR_PATH,
                    isDeleted: false,
                }
            } else if (
                row.opponentDeletedAt !== null ||
                row.opponentUsername === null ||
                row.opponentAvatar === null
            ) {
                opponent = {
                    id: row.opponentId,
                    username: 'Deleted User',
                    avatar: AVATAR_CONSTANTS.DELETED_AVATAR_PATH,
                    isDeleted: true,
                };
            } else {
                opponent = {
                    id: row.opponentId,
                    username: row.opponentUsername,
                    avatar: row.opponentAvatar,
                    isDeleted: false,
                };
            }
            return {
                score: new ScoreEntity({
                    sessionId: row.sessionId,
                    userId,
                    opponentId: row.opponentId,
                    gameId: row.gameId,
                    value: row.value ?? 0,
                    outcome: row.outcome,
                    achievedAt: row.achievedAt,
                }),
                opponent,
            };
        });
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