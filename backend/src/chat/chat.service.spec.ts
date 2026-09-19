import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, friendships, messages } from '../db/schema';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';
import { FriendRepository, FriendService } from '../friends';
import { UserRepository, UserService } from '../users';

const VALID_BCRYPT_HASH =
	'$2b$12$e80yq9O8r.xXpY4Ew9KjSeB4dO6p8q7a5d3f2g1h0j9k8l7m6n5o4';

describe('ChatService', () => {
	const chatRepo = new ChatRepository(db);
	const friendRepo = new FriendRepository(db);
	const userService = new UserService(new UserRepository(db));
	const friendService = new FriendService(friendRepo, userService);
	const service = new ChatService(chatRepo, friendService, userService);

	let userAId: string;
	let userBId: string;

	beforeAll(async () => {
		const [userA] = await db
			.insert(users)
			.values({ username: 'chat_svc_alice', email: 'chat_svc_alice@example.com', passwordHash: VALID_BCRYPT_HASH })
			.returning();
		userAId = userA.id;

		const [userB] = await db
			.insert(users)
			.values({ username: 'chat_svc_bob', email: 'chat_svc_bob@example.com', passwordHash: VALID_BCRYPT_HASH })
			.returning();
		userBId = userB.id;
	});

	afterAll(async () => {
		await db.delete(users).where(eq(users.id, userAId));
		await db.delete(users).where(eq(users.id, userBId));
		await (db.$client as any).end();
	});

	afterEach(async () => {
		await db.delete(friendships).where(eq(friendships.requesterId, userAId));
		await db.delete(friendships).where(eq(friendships.requesterId, userBId));
		await db.delete(messages).where(eq(messages.senderId, userAId));
		await db.delete(messages).where(eq(messages.senderId, userBId));
	});

	async function makeFriends(): Promise<void> {
		const request = await friendService.sendRequest(userAId, userBId);
		if (!request.success) throw new Error('setup failed');
		await friendService.acceptRequest(userBId, request.friendship.id);
	}

	describe('sendMessage', () => {
		it('rejects sending a message to yourself', async () => {
			const result = await service.sendMessage(userAId, userAId, 'hi me');
			expect(result).toEqual({ success: false, reason: 'CANNOT_MESSAGE_YOURSELF' });
		});

		it('rejects sending to a user that does not exist', async () => {
			const result = await service.sendMessage(userAId, '00000000-0000-0000-0000-000000000000', 'hi');
			expect(result).toEqual({ success: false, reason: 'TARGET_USER_NOT_FOUND' });
		});

		it('rejects sending when the two users are not friends', async () => {
			const result = await service.sendMessage(userAId, userBId, 'hi bob');
			expect(result).toEqual({ success: false, reason: 'NOT_FRIENDS' });
		});

		it('persists the message once the pair is friends', async () => {
			await makeFriends();

			const result = await service.sendMessage(userAId, userBId, 'hi bob');
			expect(result.success).toBe(true);

			const conversation = await chatRepo.listConversation(userAId, userBId);
			expect(conversation).toHaveLength(1);
		});
	});

	describe('listConversation', () => {
		it('returns null when the caller and the peer are not friends', async () => {
			const result = await service.listConversation(userAId, userBId);
			expect(result).toBeNull();
		});

		it('returns the conversation once the pair is friends', async () => {
			await makeFriends();
			await service.sendMessage(userAId, userBId, 'hi bob');

			const result = await service.listConversation(userAId, userBId);

			expect(result).not.toBeNull();
			expect(result).toHaveLength(1);
		});
	});
});
