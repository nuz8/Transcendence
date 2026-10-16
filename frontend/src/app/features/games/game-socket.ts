import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Auth } from '../../core/auth';
import { RealtimeSockets } from '../../core/realtime-sockets';
import { GAME_SOCKET_PATHS } from './game.constants';

type GatewayMessage = { event: string; data: Record<string, unknown> };
export type GameStatus = 'connecting' | 'idle' | 'queueing' | 'matched';

const RECONNECT_DELAY_MS = 3_000;

// Single owner of a game's websocket: provided per game-container so matchmaking, settings
// and the gameplay component all share one connection and status.
@Injectable()
export class GameSocket implements OnDestroy {
  private readonly realtimeSockets = inject(RealtimeSockets);
  private readonly auth = inject(Auth);
  private socket: WebSocket | null = null;
  private path: string | null = null;
  private destroyed = false;

  private readonly _status = signal<GameStatus>('connecting');
  readonly status = this._status.asReadonly();

  private readonly _sessionId = signal<string | null>(null);
  readonly sessionId = this._sessionId.asReadonly();

  private readonly _unknownGame = signal(false);
  readonly unknownGame = this._unknownGame.asReadonly();

  // Call once, with the route's gameId, to open the socket for that game.
  init(gameId: string): void {
    const path = GAME_SOCKET_PATHS[gameId];
    if (!path) {
      this._unknownGame.set(true);
      return;
    }

    this.path = path;
    this.connect(path);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.socket?.close();
  }

  queue(): void {
    this.send('queue');
    this._status.set('queueing');
  }

  leaveQueue(): void {
    this.send('leave-queue');
    this._status.set('idle');
  }

  quit(): void {
    this.send('quit');
  }

  private connect(path: string): void {
    const socket = this.realtimeSockets.open(path);
    this.socket = socket;
    socket.addEventListener('close', () => this.onClose());
    socket.addEventListener('message', (event) => this.onMessage(JSON.parse(event.data)));
  }

  private onClose(): void {
    if (this.destroyed)
      return;
    this._status.set('connecting');
    setTimeout(() => {
      if (!this.destroyed && this.path && this.auth.accessToken())
        this.connect(this.path);
    }, RECONNECT_DELAY_MS);
  }

  private send(event: string, data: unknown = {}): void {
    this.socket?.send(JSON.stringify({ event, data }));
  }

  private onMessage(message: GatewayMessage): void {
    switch (message.event) {
      case 'authenticated':
        this._status.set('idle');
        break;
      case 'created':
      case 'matched':
        this._sessionId.set((message.data['sessionId'] as string) ?? null);
        this._status.set('matched');
        break;
      case 'joined':
        this._status.set('matched');
        break;
      case 'over':
      case 'cancelled':
      case 'left queue':
        this._sessionId.set(null);
        this._status.set('idle');
        break;
      case 'error': {
        const sessionId = message.data['sessionId'] as string | undefined;
        if (sessionId) {
          // Already in an active match (e.g. after a refresh): rejoin it instead of queueing.
          this._sessionId.set(sessionId);
          this.send('join', sessionId);
        } else {
          this._status.set('idle');
        }
        break;
      }
    }
  }
}
