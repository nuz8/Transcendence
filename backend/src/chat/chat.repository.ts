import { Injectable } from '@nestjs/common';
import { and, eq, or } from 'drizzle-orm';
import { MessageEntity } from './message.entity';
import { type DB, InjectDb, messages } from '../db';

@Injectable()
export class ChatRepository {
	constructor(@InjectDb() private readonly db: DB) {}

	async create(senderId: string, receiverId: string, content: string): Promise<MessageEntity> {
		const [row] = await this.db
			.insert(messages)
			.values({ senderId, receiverId, content })
			.returning();
		return this.mapRow(row);
	}

	async listConversation(userA: string, userB: string): Promise<MessageEntity[]> {
		const rows = await this.db
			.select()
			.from(messages)
			.where(
				or(
					and(eq(messages.senderId, userA), eq(messages.receiverId, userB)),
					and(eq(messages.senderId, userB), eq(messages.receiverId, userA)),
				),
			)
			.orderBy(messages.createdAt);
		return rows.map((row) => this.mapRow(row));
	}

	private mapRow(row: typeof messages.$inferSelect): MessageEntity {
		return new MessageEntity({
			id: row.id,
			senderId: row.senderId,
			receiverId: row.receiverId,
			content: row.content,
			createdAt: row.createdAt,
		});
	}
}
