import { Injectable } from '@nestjs/common';
import { and, eq, or, sql } from 'drizzle-orm';
import { FriendshipEntity, FriendshipStatus, AcceptedFriend } from './friend.entity';
import { FRIEND_CONSTRAINTS } from './friend.constants';
import {
	type DB,
	InjectDb,
	PG_ERROR_CODES,
	getPgErrorInfo,
	friendships,
	users,
} from '../db';

export class FriendRequestConflictError extends Error {
	constructor(public readonly reason: 'already_pending' | 'already_friends') {
		super(reason.toUpperCase());
	}
}

export class FriendTargetNotFoundError extends Error {
	constructor() {
		super('TARGET_USER_NOT_FOUND');
	}
}

@Injectable()
export class FriendRepository {
	constructor(@InjectDb() private readonly db: DB) {}

	async upsertRequest(requesterId: string, addresseeId: string): Promise<FriendshipEntity> {
		const existing = await this.findPairRow(requesterId, addresseeId);

		if (existing?.status === 'pending') {
			throw new FriendRequestConflictError('already_pending');
		}
		if (existing?.status === 'accepted') {
			throw new FriendRequestConflictError('already_friends');
		}

		try {
			if (existing?.status === 'declined') {
				const [row] = await this.db
					.update(friendships)
					.set({ requesterId, addresseeId, status: 'pending', respondedAt: null })
					.where(eq(friendships.id, existing.id))
					.returning();
				return this.mapRow(row);
			}

			const [row] = await this.db
				.insert(friendships)
				.values({ requesterId, addresseeId })
				.returning();
			return this.mapRow(row);
		} catch (error: any) {
			const { code, constraint } = getPgErrorInfo(error);
			if (code === PG_ERROR_CODES.UNIQUE_VIOLATION && constraint === FRIEND_CONSTRAINTS.PAIR_UNIQUE) {
				throw new FriendRequestConflictError('already_pending');
			}
			if (code === PG_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
				throw new FriendTargetNotFoundError();
			}
			throw error;
		}
	}

	async findById(id: string): Promise<FriendshipEntity | null> {
		const [row] = await this.db
			.select()
			.from(friendships)
			.where(eq(friendships.id, id))
			.limit(1);
		return row ? this.mapRow(row) : null;
	}

	async accept(id: string): Promise<FriendshipEntity> {
		const [row] = await this.db
			.update(friendships)
			.set({ status: 'accepted', respondedAt: new Date() })
			.where(eq(friendships.id, id))
			.returning();
		return this.mapRow(row);
	}

	async decline(id: string): Promise<FriendshipEntity> {
		const [row] = await this.db
			.update(friendships)
			.set({ status: 'declined', respondedAt: new Date() })
			.where(eq(friendships.id, id))
			.returning();
		return this.mapRow(row);
	}

	async remove(id: string): Promise<void> {
		await this.db.delete(friendships).where(eq(friendships.id, id));
	}

	async listAccepted(userId: string): Promise<AcceptedFriend[]> {
		const rows = await this.db
			.select({
				friendshipId: friendships.id,
				status: friendships.status,
				createdAt: friendships.createdAt,
				friend: {
					id: users.id,
					username: users.username,
					avatar: users.avatar,
				},
			})
			.from(friendships)
			.innerJoin(
				users,
				eq(
					users.id,
					sql`CASE
						WHEN ${friendships.requesterId} = ${userId}::uuid THEN ${friendships.addresseeId}
						ELSE ${friendships.requesterId}
					END`,
				),
			)
			.where(
				and(
					eq(friendships.status, 'accepted'),
					or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
				),
			);

		return rows;
	}


	async listPending(userId: string): Promise<FriendshipEntity[]> {
		const rows = await this.db
			.select()
			.from(friendships)
			.where(
				and(
					eq(friendships.status, 'pending'),
					eq(friendships.addresseeId, userId),
				),
			);
		return rows.map((row) => this.mapRow(row));
	}

	async listOutgoingPending(userId: string): Promise<FriendshipEntity[]> {
		const rows = await this.db
			.select()
			.from(friendships)
			.where(
				and(
					eq(friendships.status, 'pending'),
					eq(friendships.requesterId, userId),
				),
			);
		return rows.map((row) => this.mapRow(row));
	}

	private async findPairRow(userA: string, userB: string) {
		const [row] = await this.db
			.select()
			.from(friendships)
			.where(sql`LEAST(${friendships.requesterId}, ${friendships.addresseeId}) = LEAST(${userA}::uuid, ${userB}::uuid)
				AND GREATEST(${friendships.requesterId}, ${friendships.addresseeId}) = GREATEST(${userA}::uuid, ${userB}::uuid)`)
			.limit(1);
		return row;
	}

	private mapRow(row: typeof friendships.$inferSelect): FriendshipEntity {
		return new FriendshipEntity({
			id: row.id,
			requesterId: row.requesterId,
			addresseeId: row.addresseeId,
			status: row.status as FriendshipStatus,
			createdAt: row.createdAt,
			respondedAt: row.respondedAt,
		});
	}
}
