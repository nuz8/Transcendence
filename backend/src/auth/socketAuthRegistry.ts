import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { WebSocket } from 'ws';
import { DenyList } from './denyList';

export const SOCKET_SWEEP_INTERVAL_MS = 30_000;

interface SocketAuthEntry {
  jti: string;
  exp: number;
}

@Injectable()
export class SocketAuthRegistry implements OnModuleDestroy {
  private readonly entries = new Map<WebSocket, SocketAuthEntry>();
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(private readonly denyList: DenyList) {
    this.sweepTimer = setInterval(() => this.sweep(), SOCKET_SWEEP_INTERVAL_MS);
  }

  register(client: WebSocket, jti: string, exp: number): void {
    this.entries.set(client, { jti, exp });
  }

  unregister(client: WebSocket): void {
    this.entries.delete(client);
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [client, { jti, exp }] of this.entries) {
      if (exp * 1000 <= now || this.denyList.isRevoked(jti)) {
        client.close(4401, 'unauthorized');
        this.entries.delete(client);
      }
    }
  }
}
