import { Injectable } from '@nestjs/common';
import { ChatRepository } from './chat.repository';
import { MessageEntity } from './message.entity';
import { SendMessageResult } from './types';
import { FriendService } from '../friends';
import { UserService } from '../users';

@Injectable()
export class ChatService {
	constructor(
		private readonly chatRepo: ChatRepository,
		private readonly friendService: FriendService,
		private readonly userService: UserService,
	) {}

	async sendMessage(senderId: string, receiverId: string, content: string): Promise<SendMessageResult> {
		if (senderId === receiverId) {
			return { success: false, reason: 'CANNOT_MESSAGE_YOURSELF' };
		}

		const targetUser = await this.userService.findById(receiverId);
		if (!targetUser) {
			return { success: false, reason: 'TARGET_USER_NOT_FOUND' };
		}

		const areFriends = await this.friendService.areFriends(senderId, receiverId);
		if (!areFriends) {
			return { success: false, reason: 'NOT_FRIENDS' };
		}

		const message = await this.chatRepo.create(senderId, receiverId, content);
		return { success: true, message };
	}

	async listConversation(callerId: string, peerId: string): Promise<MessageEntity[] | null> {
		const areFriends = await this.friendService.areFriends(callerId, peerId);
		if (!areFriends) {
			return null;
		}

		return this.chatRepo.listConversation(callerId, peerId);
	}
}
