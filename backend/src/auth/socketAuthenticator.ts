import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocket } from 'ws';
import { DenyList } from './denyList';
import { SocketAuthRegistry } from './socketAuthRegistry';

export const AUTH_GRACE_PERIOD_MS = 10_000;

type AccessTokenPayload = { sub: string; type: string; jti: string; exp: number };

@Injectable()
export class SocketAuthenticator {
  private readonly users = new Map<WebSocket, string>();
  private readonly graceTimers = new Map<WebSocket, NodeJS.Timeout>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly denyList: DenyList,
    private readonly socketAuthRegistry: SocketAuthRegistry,
  ) {}

  begin(client: WebSocket): void {
    this.graceTimers.set(client, setTimeout(() => client.close(4401, 'auth timeout'), AUTH_GRACE_PERIOD_MS));
  }

  userOf(client: WebSocket): string | undefined {
    return this.users.get(client);
  }

  release(client: WebSocket): string | undefined {
    this.clearGraceTimer(client);
    this.socketAuthRegistry.unregister(client);
    const userId = this.users.get(client);
    this.users.delete(client);
    return userId;
  }

  async authenticate(
    client: WebSocket,
    body: unknown,
    onFirstAuth: (userId: string) => void | Promise<void>,
  ): Promise<void> {
    this.clearGraceTimer(client);
    const token = this.parseToken(body);
    if (!token)
      return client.close(4401, 'unauthorized');

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);

      if (payload.type !== 'access')
        return client.close(4401, 'unauthorized');
      if (this.denyList.isRevoked(payload.jti))
        return client.close(4401, 'unauthorized');
      if (client.readyState !== WebSocket.OPEN)
        return;

      const currentUserId = this.users.get(client);
      if (currentUserId !== undefined && currentUserId !== payload.sub)
        return client.close(4401, 'unauthorized');

      this.socketAuthRegistry.register(client, payload.jti, payload.exp);
      if (currentUserId === payload.sub)
        return;

      this.users.set(client, payload.sub);
      await onFirstAuth(payload.sub);
      client.send(JSON.stringify({ event: 'authenticated', data: { userId: payload.sub } }));
    } catch {
      client.close(4401, 'unauthorized');
    }
  }

  private parseToken(body: unknown): string | null {
    if (typeof body !== 'object' || body === null) return null;

    const { token } = body as Record<string, unknown>;
    return typeof token === 'string' && token.length > 0 ? token : null;
  }

  private clearGraceTimer(client: WebSocket): void {
    const timer = this.graceTimers.get(client);
    if (!timer) return;

    clearTimeout(timer);
    this.graceTimers.delete(client);
  }
}
