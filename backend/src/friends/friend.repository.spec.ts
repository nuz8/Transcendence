import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, friendships } from '../db/schema';
import { FriendRepository, FriendRequestConflictError } from './friend.repository';

const VALID_BCRYPT_HASH =
	'$2b$12$e80yq9O8r.xXpY4Ew9KjSeB4dO6p8q7a5d3f2g1h0j9k8l7m6n5o4';

describe('FriendRepository', () => {
	const repo = new FriendRepository(db);

	let userAId: string;
	let userBId: string;

	beforeAll(async () => {
		const [userA] = await db
			.insert(users)
			.values({
				username: 'friend_repo_alice',
				email: 'friend_repo_alice@example.com',
				passwordHash: VALID_BCRYPT_HASH,
			})
			.returning();
		userAId = userA.id;

		const [userB] = await db
			.insert(users)
			.values({
				username: 'friend_repo_bob',
				email: 'friend_repo_bob@example.com',
				passwordHash: VALID_BCRYPT_HASH,
			})
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

	describe('upsertRequest', () => {
		it('creates a pending request when no row exists for the pair', async () => {
			const row = await repo.upsertRequest(userAId, userBId);

			expect(row.status).toBe('pending');
			expect(row.requesterId).toBe(userAId);
			expect(row.addresseeId).toBe(userBId);
		});

		it('rejects a duplicate request while one is already pending', async () => {
			await repo.upsertRequest(userAId, userBId);

			await expect(repo.upsertRequest(userAId, userBId))
				.rejects.toBeInstanceOf(FriendRequestConflictError);
		});

		it('rejects a reversed request while one is already pending', async () => {
			await repo.upsertRequest(userAId, userBId);

			await expect(repo.upsertRequest(userBId, userAId))
				.rejects.toBeInstanceOf(FriendRequestConflictError);
		});

		it('reactivates a declined request instead of creating a new row', async () => {
			const first = await repo.upsertRequest(userAId, userBId);
			await repo.decline(first.id);

			const second = await repo.upsertRequest(userBId, userAId);

			expect(second.id).toBe(first.id);
			expect(second.status).toBe('pending');
			expect(second.requesterId).toBe(userBId);
			expect(second.addresseeId).toBe(userAId);
		});

		it('rejects a request once the pair is already friends', async () => {
			const row = await repo.upsertRequest(userAId, userBId);
			await repo.accept(row.id);

			await expect(repo.upsertRequest(userAId, userBId))
				.rejects.toBeInstanceOf(FriendRequestConflictError);
		});
	});

	describe('listPending', () => {
		it('returns only requests received, not requests sent', async () => {
			const request = await repo.upsertRequest(userAId, userBId);

			const forRequester = await repo.listPending(userAId);
			const forAddressee = await repo.listPending(userBId);

			expect(forRequester.map((r) => r.id)).not.toContain(request.id);
			expect(forAddressee.map((r) => r.id)).toContain(request.id);
		});
	});

	describe('listOutgoingPending', () => {
		it('returns only requests sent, not requests received', async () => {
			const request = await repo.upsertRequest(userAId, userBId);

			const forRequester = await repo.listOutgoingPending(userAId);
			const forAddressee = await repo.listOutgoingPending(userBId);

			expect(forRequester.map((r) => r.id)).toContain(request.id);
			expect(forAddressee.map((r) => r.id)).not.toContain(request.id);
		});
	});

	describe('areFriends', () => {
		it('returns true when the pair is accepted, regardless of direction', async () => {
			const [row] = await db
				.insert(friendships)
				.values({ requesterId: userAId, addresseeId: userBId, status: 'accepted' })
				.returning();

			expect(await repo.areFriends(userAId, userBId)).toBe(true);
			expect(await repo.areFriends(userBId, userAId)).toBe(true);

			await db.delete(friendships).where(eq(friendships.id, row.id));
		});

		it('returns false when the pair is only pending', async () => {
			const [row] = await db
				.insert(friendships)
				.values({ requesterId: userAId, addresseeId: userBId, status: 'pending' })
				.returning();

			expect(await repo.areFriends(userAId, userBId)).toBe(false);

			await db.delete(friendships).where(eq(friendships.id, row.id));
		});

		it('returns false when there is no relationship at all', async () => {
			expect(await repo.areFriends(userAId, userBId)).toBe(false);
		});
	});

});
