import { Inject, Injectable } from "@nestjs/common";
import type { DB } from '../db/client';
import { InjectDb } from "../db/db.provider";
import { scores } from '../db/schema';
import { ScoreEntity } from "./score.entity";

@Injectable()
export class ScoreRepository {
    constructor(@InjectDb() private readonly db: DB) {}

    async create(score: ScoreEntity): Promise<void> {
        await this.db.insert(scores).values({
            sessionId: score.sessionId,
            userId: score.userId,
            gameId: score.gameId,
            value: score.value,
            outcome: score.outcome as 'win' | 'lose' | 'draw' | 'forfeit',
            achievedAt: score.achievedAt,
        });
    }
}