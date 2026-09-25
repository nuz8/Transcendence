import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { isUUID } from 'class-validator';
import { DenyList } from '../auth/denyList';
import { ChatService } from './chat.service';
import { SocketAuthRegistry } from '../auth/socketAuthRegistry';

@WebSocketGateway({ path: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
	private readonly users = new Map<WebSocket, string>();
	private readonly sockets = new Map<string, Set<WebSocket>>();

	constructor(
		private readonly chatService: ChatService,
		private readonly jwtService: JwtService,
		private readonly denyList: DenyList,
		private readonly socketAuthRegistry: SocketAuthRegistry,
	) {}

	handleConnection(client: WebSocket, request: IncomingMessage): void {
		client.pause();
		void this.authenticate(client, request);
	}

	handleDisconnect(client: WebSocket): void {
		this.socketAuthRegistry.unregister(client);
		const userId = this.users.get(client);
		if (!userId) return;

		this.users.delete(client);
		this.removeSocket(userId, client);
	}

	@SubscribeMessage('send')
	async send(@ConnectedSocket() client: WebSocket, @MessageBody() body: unknown): Promise<void> {
		const senderId = this.users.get(client);
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

	private async authenticate(client: WebSocket, request: IncomingMessage): Promise<void> {
		const [type, token] = request.headers.authorization?.split(' ') ?? [];
		if (type !== 'Bearer' || !token)
			return client.close(4401, 'unauthorized');

		try {
			const payload = await this.jwtService.verifyAsync<{ sub: string; type: string; jti: string; exp: number }>(token);

			if (payload.type !== 'access')
				return client.close(4401, 'unauthorized');
			if (this.denyList.isRevoked(payload.jti))
				return client.close(4401, 'unauthorized');

			this.users.set(client, payload.sub);
			this.addSocket(payload.sub, client);
			this.socketAuthRegistry.register(client, payload.jti, payload.exp);
			client.resume();
		} catch {
			client.close(4401, 'unauthorized');
		}
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

	private broadcastTo(userId: string, event: string, data: unknown): void {
		const clients = this.sockets.get(userId);
		if (!clients) return;

		for (const client of clients)
			this.emit(client, event, data);
	}

	private emit(client: WebSocket, event: string, data: unknown): void {
		if (client.readyState !== WebSocket.OPEN) return;
		client.send(JSON.stringify({ event, data }));
	}
}
