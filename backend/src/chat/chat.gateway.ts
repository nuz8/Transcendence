import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { WebSocket } from 'ws';
import { isUUID } from 'class-validator';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SocketAuthenticator } from '../auth/socketAuthenticator';
import { PresenceService, type PresenceChange } from '../presence/presence.service';
import { FriendService } from '../friends';


@WebSocketGateway({ path: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
	private readonly logger = new Logger(ChatGateway.name);
	private readonly sockets = new Map<string, Set<WebSocket>>();

	constructor(
		private readonly chatService: ChatService,
		private readonly socketAuthenticator: SocketAuthenticator,
		private readonly presenceService: PresenceService,
		private readonly friendService: FriendService,
	) {
		this.presenceService.onChange((change) => this.notifyFriends(change));
	}

	handleConnection(client: WebSocket): void {
		this.socketAuthenticator.begin(client);
	}

	handleDisconnect(client: WebSocket): void {
		const userId = this.socketAuthenticator.release(client);
		if (!userId) return;

		this.removeSocket(userId, client);
		this.presenceService.disconnect(userId, client);
	}

	@SubscribeMessage('auth')
	async auth(@ConnectedSocket() client: WebSocket, @MessageBody() body: unknown): Promise<void> {
		await this.socketAuthenticator.authenticate(client, body, (userId) => this.onFirstAuth(client, userId));
	}

	@SubscribeMessage('send')
	async send(@ConnectedSocket() client: WebSocket, @MessageBody() body: unknown): Promise<void> {
		const senderId = this.socketAuthenticator.userOf(client);
		if (!senderId)
			return this.emit(client, 'error', { message: 'not authenticated' });

		const parsed = this.parsePayload(body);
		if (!parsed)
			return this.emit(client, 'error', { message: 'invalid payload' });

		const result = await this.chatService.sendMessage(senderId, parsed.to, parsed.content);
		if (!result.success)
			return this.emit(client, 'error', { message: result.reason });

		this.broadcastTo(senderId, 'message', result.message);
		this.broadcastTo(parsed.to, 'message', result.message);
	}

	private parsePayload(body: unknown): { to: string; content: string } | null {
		if (typeof body !== 'object' || body === null) return null;

		const { to, content } = body as Record<string, unknown>;
		if (typeof to !== 'string' || !isUUID(to)) return null;
		if (typeof content !== 'string') return null;

		const trimmed = content.trim();
		if (trimmed.length < 1 || trimmed.length > 2000) return null;

		return { to, content: trimmed };
	}

	private async onFirstAuth(client: WebSocket, userId: string): Promise<void> {
		this.addSocket(userId, client);
		this.presenceService.connect(userId, client);
		await this.sendPresenceSnapshot(userId, client);
	}

	private addSocket(userId: string, client: WebSocket): void {
		const existing = this.sockets.get(userId);
		if (existing) {
			existing.add(client);
		} else {
			this.sockets.set(userId, new Set([client]));
		}
	}

	private removeSocket(userId: string, client: WebSocket): void {
		const existing = this.sockets.get(userId);
		if (!existing) return;

		existing.delete(client);
		if (existing.size === 0)
			this.sockets.delete(userId);
	}

	private async sendPresenceSnapshot(userId: string, client: WebSocket): Promise<void> {
		const friends = await this.friendService.listFriends(userId);
		const snapshot = friends.map(({ friend }) => ({
			userId: friend.id,
			online: this.presenceService.isOnline(friend.id),
		}));
		this.emit(client, 'presence:snapshot', snapshot);
	}


	private broadcastTo(userId: string, event: string, data: unknown): void {
		const clients = this.sockets.get(userId);
		if (!clients) return;

		for (const client of clients)
			this.emit(client, event, data);
	}

	private notifyFriends(change: PresenceChange): void {
		this.friendService.listFriends(change.userId)
			.then((friends) => {
				for (const { friend } of friends)
					this.broadcastTo(friend.id, 'presence', change);
			})
			.catch((err) => this.logger.error('failed to notify friends of a presence change', err));
	}

	private emit(client: WebSocket, event: string, data: unknown): void {
		if (client.readyState !== WebSocket.OPEN) return;
		client.send(JSON.stringify({ event, data }));
	}
}
