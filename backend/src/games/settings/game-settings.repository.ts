import { Injectable } from '@nestjs/common';
import { type DB } from '../../db';
import { InjectDb } from '../../db/db.provider';
import { gameSettings } from '../../db/schema';
import { GameSettingsEntity } from './game-settings.entity';
import { getPgErrorInfo, PG_ERROR_CODES } from '../../db';
import { and, eq } from 'drizzle-orm';

export class UnknownGameError extends Error {
    constructor(gameId: string) {
        super(`Unknown game: ${gameId}`);
    }
}

@Injectable()
export class GameSettingsRepository {
    constructor(@InjectDb() private readonly db: DB) {}

    async findByUserAndGame(userId: string, gameId: string): Promise<GameSettingsEntity | null> {
        const [row] = await this.db
            .select()
            .from(gameSettings)
            .where(and(eq(gameSettings.userId, userId), eq(gameSettings.gameId, gameId)));
        return row ? this.mapRow(row) : null;
    }

    async save(settings: GameSettingsEntity): Promise<GameSettingsEntity> {
        try {
            const [row] = await this.db
                .insert(gameSettings)
                .values({
                    userId: settings.userId,
                    gameId: settings.gameId,
                    target: settings.target,
                    mode: settings.mode,
                    theme: settings.theme,
                    powerUps: settings.powerUps,
                })
                .onConflictDoUpdate({
                    target: [gameSettings.userId, gameSettings.gameId],
                    set: {
                        target: settings.target,
                        mode: settings.mode,
                        theme: settings.theme,
                        powerUps: settings.powerUps,
                    },
                })
                .returning();
            return this.mapRow(row);
        } catch (err) {
            if (getPgErrorInfo(err)?.code === PG_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
                throw new UnknownGameError(settings.gameId);
            }
            throw err;
        }
    }

    private mapRow(row: typeof gameSettings.$inferSelect): GameSettingsEntity {
        return new GameSettingsEntity({
            userId: row.userId,
            gameId: row.gameId,
            target: row.target,
            mode: row.mode,
            theme: row.theme,
            powerUps: row.powerUps,
        });
    }

}