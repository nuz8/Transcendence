import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { ReplaySubject } from 'rxjs';
import { Auth } from '../../core/auth';
import { RealtimeSockets } from '../../core/realtime-sockets';
import { GAME_SOCKET_PATHS } from './game.constants';

export type GatewayMessage = { event: string; data: Record<string, unknown> };
export type GameStatus = 'connecting' | 'idle' | 'queueing' | 'matched' | 'over';

const RECONNECT_DELAY_MS = 3_000;
const CLOCK_TICK_MS = 250;

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

  // Whether the opponent currently has a live connection; false between 'opponent_disconnected' and 'opponent_reconnected'.
  private readonly _opponentConnected = signal(true);
  readonly opponentConnected = this._opponentConnected.asReadonly();

  // Set when a match ends without a winner (e.g. opponent gone before any round finished); cleared once a new match starts.
  private readonly _endMessage = signal<string | null>(null);
  readonly endMessage = this._endMessage.asReadonly();

  // Counts down the opponent's reconnect window; set from 'opponent_disconnected', cleared on reconnect/end.
  private readonly reconnectDeadline = signal<number | null>(null);
  readonly reconnectTimeLeft = computed(() => {
    const deadline = this.reconnectDeadline();
    return deadline === null ? null : Math.max(0, Math.ceil((deadline - this.now()) / 1000));
  });

  // Server only sends a time-left snapshot per message; a deadline plus a local tick keeps it counting down between messages.
  // Frozen while the opponent is disconnected, since the server pauses the round clock too.
  private readonly deadline = signal<number | null>(null);
  private readonly frozenMsLeft = signal<number | null>(null);
  private readonly now = signal(Date.now());
  private readonly clockTimer = setInterval(() => this.now.set(Date.now()), CLOCK_TICK_MS);
  readonly roundTimeLeft = computed(() => {
    const frozen = this.frozenMsLeft();
    if (frozen !== null)
      return Math.ceil(frozen / 1000);
    const deadline = this.deadline();
    return deadline === null ? null : Math.max(0, Math.ceil((deadline - this.now()) / 1000));
  });

  // Raw events a gameplay component needs beyond status (e.g. 'moved', 'round'); GameSocket itself ignores these.
  // Replays the last message: the gameplay component only subscribes after the 'matched'/'joined' status
  // flip has already re-rendered it in, so a plain Subject would drop that very message.
  private readonly messageSubject = new ReplaySubject<GatewayMessage>(1);
  readonly messages$ = this.messageSubject.asObservable();

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
    clearInterval(this.clockTimer);
    this.socket?.close();
  }

  // Lets a gameplay component feed each message's round-time snapshot (ms, or null to stop the clock).
  setRoundTimeLeft(ms: unknown): void {
    // The server keeps its clock paused while the opponent is disconnected, so freeze instead of starting a new countdown
    // (otherwise e.g. a move made during the disconnect would reset and restart the display even though the clock isn't running).
    if (!this._opponentConnected()) {
      this.frozenMsLeft.set(typeof ms === 'number' ? ms : null);
      return;
    }
    this.frozenMsLeft.set(null);
    if (typeof ms !== 'number') {
      this.deadline.set(null);
      return;
    }
    // Anchor both signals to the same instant: a stale `now` would overshoot the deadline and round up a second too many.
    const nowMs = Date.now();
    this.now.set(nowMs);
    this.deadline.set(nowMs + ms);
  }

  private msLeft(): number | null {
    const deadline = this.deadline();
    return deadline === null ? null : Math.max(0, deadline - Date.now());
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

  // Called once the user is done looking at the final result, to bring back matchmaking.
  backToMatchmaking(): void {
    this._sessionId.set(null);
    this._status.set('idle');
  }

  // Lets a gameplay component send its own events (e.g. 'move') once a match is active.
  send(event: string, data: unknown = {}): void {
    this.socket?.send(JSON.stringify({ event, data }));
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

  private onMessage(message: GatewayMessage): void {
    this.messageSubject.next(message);
    switch (message.event) {
      case 'authenticated':
        this._status.set('idle');
        break;
      case 'created':
      case 'matched':
        this._sessionId.set((message.data['sessionId'] as string) ?? null);
        this._status.set('matched');
        this._opponentConnected.set(true);
        this.reconnectDeadline.set(null);
        this._endMessage.set(null);
        break;
      case 'joined':
        this._status.set('matched');
        this._opponentConnected.set(true);
        this.reconnectDeadline.set(null);
        break;
      case 'opponent_disconnected': {
        this._opponentConnected.set(false);
        // The server pauses the round clock too; freeze the display at whatever it currently reads.
        this.frozenMsLeft.set(this.msLeft());
        const reconnectTime = message.data['reconnectTime'];
        this.reconnectDeadline.set(typeof reconnectTime === 'number' ? Date.now() + reconnectTime : null);
        break;
      }
      case 'opponent_reconnected':
        this._opponentConnected.set(true);
        this.reconnectDeadline.set(null);
        this.setRoundTimeLeft(message.data['roundTimeLeft']);
        break;
      case 'over':
        this._status.set('over'); // Stays mounted so the gameplay component can show the final result
        this.reconnectDeadline.set(null);
        break;
      case 'cancelled':
        this._sessionId.set(null);
        this._status.set('idle');
        this.reconnectDeadline.set(null);
        this._endMessage.set((message.data['message'] as string) ?? 'Match cancelled.');
        break;
      case 'left queue':
        this._sessionId.set(null);
        this._status.set('idle');
        this.reconnectDeadline.set(null);
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
