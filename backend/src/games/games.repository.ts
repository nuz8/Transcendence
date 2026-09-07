import { Injectable } from '@nestjs/common';
import { isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { games } from '../db/schema';
import { GameEntity } from './game.entity';

@Injectable()
export class GamesRepository {
    async findAll(): Promise<GameEntity[]> {
        const rows = await db.select({ id: games.id, name: games.name }).from(games).where(isNull(games.deletedAt));

        return rows.map((row) => new GameEntity({ id:  row.id, name: row.name }));
    }
}
