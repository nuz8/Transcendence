import { Injectable } from '@nestjs/common';
import { isNull } from 'drizzle-orm';
import type { DB } from '../db/client';
import { games } from '../db/schema';
import { GameEntity } from './game.entity';
import { InjectDb } from '../db/db.provider';

@Injectable()
export class GameRepository {
    constructor(@InjectDb() private readonly db: DB) {}
    
    async findAll(): Promise<GameEntity[]> {
        const rows = await this.db.select({ id: games.id, name: games.name }).from(games).where(isNull(games.deletedAt));

        return rows.map((row) => new GameEntity({ id:  row.id, name: row.name }));
    }

    async ensureExists(id: string, name: string): Promise<void> {
        await this.db.insert(games).values({ id, name }).onConflictDoNothing();
    }
}
