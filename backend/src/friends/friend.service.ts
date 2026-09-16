import { Injectable } from '@nestjs/common';
import { FriendRepository, FriendRequestConflictError, FriendTargetNotFoundError } from './friend.repository';
import { FriendshipEntity, AcceptedFriend } from './friend.entity';
import { SendFriendRequestResult, RespondToFriendRequestResult, RemoveFriendResult } from './types';
import { UserService } from '../users';

@Injectable()
export class FriendService {
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
		return this.respondToRequest(callerId, friendshipId, (id) => this.friendRepo.accept(id));
	}

	async declineRequest(callerId: string, friendshipId: string): Promise<RespondToFriendRequestResult> {
		return this.respondToRequest(callerId, friendshipId, (id) => this.friendRepo.decline(id));
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

	private async respondToRequest(
		callerId: string,
		friendshipId: string,
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
		return { success: true, friendship };
	}
}
