import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { FriendRepository, FriendRequestConflictError, FriendTargetNotFoundError } from './friend.repository';
import { FriendshipEntity, AcceptedFriend } from './friend.entity';
import {
	SendFriendRequestResult,
	RespondToFriendRequestResult,
	RemoveFriendResult,
	FriendshipRelationship,
	FriendshipChange,
	FriendshipChangeKind,
} from './types';
import { UserService } from '../users/user.service';

@Injectable()
export class FriendService {
	private readonly events = new EventEmitter();
	constructor(
		private readonly friendRepo: FriendRepository,
		private readonly userService: UserService,
	) {}

	async sendRequest(callerId: string, addresseeId: string): Promise<SendFriendRequestResult> {
		if (callerId === addresseeId) {
			return { success: false, reason: 'CANNOT_FRIEND_YOURSELF' };
		}

		const targetUser = await this.userService.findById(addresseeId);
		if (!targetUser) {
			return { success: false, reason: 'TARGET_USER_NOT_FOUND' };
		}

		try {
			const friendship = await this.friendRepo.upsertRequest(callerId, addresseeId);
			this.emitChange('requested', friendship);
			return { success: true, friendship };
		} catch (error) {
			if (error instanceof FriendRequestConflictError) {
				return {
					success: false,
					reason: error.reason === 'already_pending' ? 'ALREADY_PENDING' : 'ALREADY_FRIENDS',
				};
			}
			if (error instanceof FriendTargetNotFoundError) {
				return { success: false, reason: 'TARGET_USER_NOT_FOUND' };
			}
			throw error;
		}
	}

	async acceptRequest(callerId: string, friendshipId: string): Promise<RespondToFriendRequestResult> {
		return this.respondToRequest(callerId, friendshipId, 'accepted', (id) => this.friendRepo.accept(id));
	}

	async declineRequest(callerId: string, friendshipId: string): Promise<RespondToFriendRequestResult> {
		return this.respondToRequest(callerId, friendshipId, 'declined', (id) => this.friendRepo.decline(id));
	}

	async removeFriend(callerId: string, friendshipId: string): Promise<RemoveFriendResult> {
		const row = await this.friendRepo.findById(friendshipId);
		if (!row || row.status !== 'accepted') {
			return { success: false, reason: 'FRIENDSHIP_NOT_FOUND' };
		}
		if (row.requesterId !== callerId && row.addresseeId !== callerId) {
			return { success: false, reason: 'NOT_ALLOWED_ON_THIS_FRIENDSHIP' };
		}

		await this.friendRepo.remove(friendshipId);
		this.emitChange('removed', row);
		return { success: true };
	}


	async listFriends(userId: string): Promise<AcceptedFriend[]> {
		return this.friendRepo.listAccepted(userId);
	}


	async listPendingRequests(userId: string): Promise<FriendshipEntity[]> {
		return this.friendRepo.listPending(userId);
	}

	async listOutgoingPendingRequests(userId: string): Promise<FriendshipEntity[]> {
		return this.friendRepo.listOutgoingPending(userId);
	}

	async areFriends(userA: string, userB: string): Promise<boolean> {
		return this.friendRepo.areFriends(userA, userB);
	}

	private async respondToRequest(
		callerId: string,
		friendshipId: string,
		kind: FriendshipChangeKind,
		transition: (id: string) => Promise<FriendshipEntity>,
	): Promise<RespondToFriendRequestResult> {
		const row = await this.friendRepo.findById(friendshipId);
		if (!row) {
			return { success: false, reason: 'FRIENDSHIP_NOT_FOUND' };
		}
		if (row.addresseeId !== callerId) {
			return { success: false, reason: 'NOT_ALLOWED_ON_THIS_FRIENDSHIP' };
		}
		if (row.status !== 'pending') {
			return { success: false, reason: 'FRIENDSHIP_NOT_PENDING' };
		}

		const friendship = await transition(friendshipId);
		this.emitChange(kind, friendship);
		return { success: true, friendship };
	}


	async getRelationship(
		callerId: string,
		targetId: string
	): Promise<FriendshipRelationship> {
		if (callerId === targetId) {
			return { state: 'self', friendshipId: null };
		}

		const row = await this.friendRepo.findBetween(callerId, targetId);
		if (!row || row.status === 'declined') {
			return { state: 'none', friendshipId: null };
		}
		if (row.status === 'accepted') {
			return { state: 'friends', friendshipId: row.id };
		}
		return {
			state: row.requesterId === callerId ? 'pending_outgoing' : 'pending_incoming',
			friendshipId: row.id,
		};
	}

	onChange(listener: (change: FriendshipChange) => void): void {
		this.events.on('change', listener);
	}

	private emitChange(kind: FriendshipChangeKind, friendship: FriendshipEntity): void {
		this.events.emit('change', {
			kind,
			requesterId: friendship.requesterId,
			addresseeId: friendship.addresseeId,
		} satisfies FriendshipChange);
	}
}
