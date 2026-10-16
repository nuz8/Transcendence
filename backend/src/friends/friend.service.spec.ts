import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, friendships } from '../db/schema';
import { FriendRepository } from './friend.repository';
import { FriendService } from './friend.service';
import { UserRepository, UserService } from '../users';
import { FriendshipChange } from './types';

const VALID_BCRYPT_HASH =
	'$2b$12$e80yq9O8r.xXpY4Ew9KjSeB4dO6p8q7a5d3f2g1h0j9k8l7m6n5o4';

describe('FriendService', () => {
	const repo = new FriendRepository(db);
	const userService = new UserService(new UserRepository(db));
	const service = new FriendService(repo, userService);


	let userAId: string;
	let userBId: string;

	beforeAll(async () => {
		const [userA] = await db
			.insert(users)
			.values({ username: 'friend_svc_alice', email: 'friend_svc_alice@example.com', passwordHash: VALID_BCRYPT_HASH })
			.returning();
		userAId = userA.id;

		const [userB] = await db
			.insert(users)
			.values({ username: 'friend_svc_bob', email: 'friend_svc_bob@example.com', passwordHash: VALID_BCRYPT_HASH })
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
	});

	describe('sendRequest', () => {
		it('rejects sending a request to yourself', async () => {
			const result = await service.sendRequest(userAId, userAId);
			expect(result).toEqual({ success: false, reason: 'CANNOT_FRIEND_YOURSELF' });
		});
	});

	describe('acceptRequest', () => {
		it('lets the addressee accept a pending request', async () => {
			const created = await service.sendRequest(userAId, userBId);
			if (!created.success) throw new Error('setup failed');

			const result = await service.acceptRequest(userBId, created.friendship.id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.friendship.status).toBe('accepted');
			}
		});

		it('rejects acceptance from the requester', async () => {
			const created = await service.sendRequest(userAId, userBId);
			if (!created.success) throw new Error('setup failed');

			const result = await service.acceptRequest(userAId, created.friendship.id);
			expect(result).toEqual({ success: false, reason: 'NOT_ALLOWED_ON_THIS_FRIENDSHIP' });
		});

		it('rejects accepting an unknown friendship id', async () => {
			const result = await service.acceptRequest(userBId, '00000000-0000-0000-0000-000000000000');
			expect(result).toEqual({ success: false, reason: 'FRIENDSHIP_NOT_FOUND' });
		});

		it('rejects accepting a request that is not pending anymore', async () => {
			const created = await service.sendRequest(userAId, userBId);
			if (!created.success) throw new Error('setup failed');
			await service.acceptRequest(userBId, created.friendship.id);

			const result = await service.acceptRequest(userBId, created.friendship.id);
			expect(result).toEqual({ success: false, reason: 'FRIENDSHIP_NOT_PENDING' });
		});
	});

	describe('declineRequest', () => {
		it('lets the addressee decline a pending request', async () => {
			const created = await service.sendRequest(userAId, userBId);
			if (!created.success) throw new Error('setup failed');

			const result = await service.declineRequest(userBId, created.friendship.id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.friendship.status).toBe('declined');
			}
		});

	});

	describe('removeFriend', () => {
		it('lets either participant remove an accepted friendship', async () => {
			const created = await service.sendRequest(userAId, userBId);
			if (!created.success) throw new Error('setup failed');
			await service.acceptRequest(userBId, created.friendship.id);

			const result = await service.removeFriend(userBId, created.friendship.id);
			expect(result).toEqual({ success: true });

			const stillThere = await repo.findById(created.friendship.id);
			expect(stillThere).toBeNull();
		});

		it('rejects removing a friendship that is only pending, not accepted yet', async () => {
			const created = await service.sendRequest(userAId, userBId);
			if (!created.success) throw new Error('setup failed');

			const result = await service.removeFriend(userAId, created.friendship.id);
			expect(result).toEqual({ success: false, reason: 'FRIENDSHIP_NOT_FOUND' });
		});

		it('rejects removing a friendship the caller is not part of', async () => {
			const created = await service.sendRequest(userAId, userBId);
			if (!created.success) throw new Error('setup failed');
			await service.acceptRequest(userBId, created.friendship.id);

			const result = await service.removeFriend('00000000-0000-0000-0000-000000000000', created.friendship.id);
			expect(result).toEqual({ success: false, reason: 'NOT_ALLOWED_ON_THIS_FRIENDSHIP' });
		});
	});

	describe('change events', () => {
		function listen(): { service: FriendService; changes: FriendshipChange[] } {
			const listened = new FriendService(repo, userService);
			const changes: FriendshipChange[] = [];
			listened.onChange((change) => changes.push(change));
			return { service: listened, changes };
		}

		it('emits requested once the request is saved, and nothing for a refused one', async () => {
			const { service, changes } = listen();

			await service.sendRequest(userAId, userAId);
			expect(changes).toEqual([]);

			await service.sendRequest(userAId, userBId);
			expect(changes).toEqual([{ kind: 'requested', requesterId: userAId, addresseeId: userBId }]);
		});

		it('emits accepted only when the addressee accepts', async () => {
			const { service, changes } = listen();
			const created = await service.sendRequest(userAId, userBId);
			if (!created.success) throw new Error('setup failed');
			changes.length = 0;

			await service.acceptRequest(userAId, created.friendship.id);
			expect(changes).toEqual([]);

			await service.acceptRequest(userBId, created.friendship.id);
			expect(changes).toEqual([{ kind: 'accepted', requesterId: userAId, addresseeId: userBId }]);
		});

		it('emits removed once the friendship is deleted', async () => {
			const { service, changes } = listen();
			const created = await service.sendRequest(userAId, userBId);
			if (!created.success) throw new Error('setup failed');
			await service.acceptRequest(userBId, created.friendship.id);
			changes.length = 0;

			await service.removeFriend(userBId, created.friendship.id);
			expect(changes).toEqual([{ kind: 'removed', requesterId: userAId, addresseeId: userBId }]);
		});
	});

});
