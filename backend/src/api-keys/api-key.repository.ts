import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { type DB, InjectDb, apiKeys, users } from '../db';

export type ApiKeyRow = { id: string; prefix: string; createdAt: Date };

@Injectable()
export class ApiKeyRepository {
	constructor(@InjectDb() private readonly db: DB) {}

	async create(userId: string, keyHash: string, prefix: string): Promise<ApiKeyRow> {
		const [row] = await this.db
			.insert(apiKeys)
			.values({ userId, keyHash, prefix })
			.returning({ id: apiKeys.id, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt });
		return row;
	}

	async countByUser(userId: string): Promise<number> {
		const [row] = await this.db.select({ total: count() }).from(apiKeys).where(eq(apiKeys.userId, userId));
		return row.total;
	}

	listByUser(userId: string): Promise<ApiKeyRow[]> {
		return this.db
			.select({ id: apiKeys.id, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt })
			.from(apiKeys)
			.where(eq(apiKeys.userId, userId))
			.orderBy(desc(apiKeys.createdAt));
	}

	async remove(id: string, userId: string): Promise<boolean> {
		const rows = await this.db
			.delete(apiKeys)
			.where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
			.returning({ id: apiKeys.id });
		return rows.length > 0;
	}

	async findOwner(keyHash: string): Promise<{ keyId: string; userId: string } | null> {
		const [row] = await this.db
			.select({ keyId: apiKeys.id, userId: apiKeys.userId })
			.from(apiKeys)
			.innerJoin(users, eq(users.id, apiKeys.userId))
			.where(and(eq(apiKeys.keyHash, keyHash), isNull(users.deletedAt)))
			.limit(1);
		return row ?? null;
	}
}
