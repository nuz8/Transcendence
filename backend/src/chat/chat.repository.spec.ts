import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, messages } from '../db/schema';
import { ChatRepository } from './chat.repository';

const VALID_BCRYPT_HASH =
	'$2b$12$e80yq9O8r.xXpY4Ew9KjSeB4dO6p8q7a5d3f2g1h0j9k8l7m6n5o4';

describe('ChatRepository', () => {
	const repo = new ChatRepository(db);

	let userAId: string;
	let userBId: string;
	let userCId: string;

	beforeAll(async () => {
		const [userA] = await db
			.insert(users)
			.values({
				username: 'chat_repo_alice',
				email: 'chat_repo_alice@example.com',
				passwordHash: VALID_BCRYPT_HASH,
			})
			.returning();
		userAId = userA.id;

		const [userB] = await db
			.insert(users)
			.values({
				username: 'chat_repo_bob',
				email: 'chat_repo_bob@example.com',
				passwordHash: VALID_BCRYPT_HASH,
			})
			.returning();
		userBId = userB.id;

		const [userC] = await db
			.insert(users)
			.values({
				username: 'chat_repo_carol',
				email: 'chat_repo_carol@example.com',
				passwordHash: VALID_BCRYPT_HASH,
			})
			.returning();
		userCId = userC.id;
	});

	afterAll(async () => {
		await db.delete(users).where(eq(users.id, userAId));
		await db.delete(users).where(eq(users.id, userBId));
		await db.delete(users).where(eq(users.id, userCId));
		await (db.$client as any).end();
	});

	afterEach(async () => {
		await db.delete(messages).where(eq(messages.senderId, userAId));
		await db.delete(messages).where(eq(messages.senderId, userBId));
		await db.delete(messages).where(eq(messages.senderId, userCId));
	});

	describe('create', () => {
		it('persists a message and returns it', async () => {
			const message = await repo.create(userAId, userBId, 'hello bob');

			expect(message.senderId).toBe(userAId);
			expect(message.receiverId).toBe(userBId);
			expect(message.content).toBe('hello bob');
			expect(message.id).toBeTruthy();
		});
	});

	describe('listConversation', () => {
		it('returns messages from both directions in chronological order', async () => {
			const first = await repo.create(userAId, userBId, 'hi');
			const second = await repo.create(userBId, userAId, 'hi back');

			const conversation = await repo.listConversation(userAId, userBId);

			expect(conversation.map((m) => m.id)).toEqual([first.id, second.id]);
		});

		it('does not leak messages exchanged with a third user', async () => {
			const withBob = await repo.create(userAId, userBId, 'for bob');
			await repo.create(userAId, userCId, 'for carol');

			const conversation = await repo.listConversation(userAId, userBId);

			expect(conversation.map((m) => m.id)).toEqual([withBob.id]);
		});
	});
});
