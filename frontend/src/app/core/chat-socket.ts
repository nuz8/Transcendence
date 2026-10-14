import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subject } from 'rxjs';
import { RealtimeSockets } from './realtime-sockets';
import type { MessageResponseDto } from './modules/openapi';
import { Auth } from './auth';

const REOPEN_DELAY_MS = 5_000;

// Single owner of the /chat socket: to carry both chat messages and presence
@Injectable({ providedIn: 'root' })
export class ChatSocket {
  private readonly auth = inject(Auth);
  private readonly realtimeSockets = inject(RealtimeSockets);
  private socket: WebSocket | null = null;
  private reopenTimer: ReturnType<typeof setTimeout> | null = null;

  // An open socket is not enough, as backend rejects 'send' until it has confirmed 'auth'
  private readonly _ready = signal(false);
  readonly ready = this._ready.asReadonly();
  
  private readonly messageSubject = new Subject<MessageResponseDto>();
  readonly messages$ = this.messageSubject.asObservable();

  // For previously dropped gateway 'error' events (NOT_FRIENDS, invalid payload)
  private readonly errorSubject = new Subject<string>();
  readonly errors$ = this.errorSubject.asObservable();

  constructor() {
    effect(() => {
      if (this.auth.accessToken()) {
        untracked(() => this.open());
      }
    });
  }


  // Returns false instead of throwing or silently dropping, so the caller can keep the draft
  send(to: string, content: string): boolean {
    const socket = this.socket;
    if (!this._ready() || !socket || socket.readyState !== WebSocket.OPEN)
      return false;
    
    socket.send(JSON.stringify({ event: 'send', data: { to, content } }));
    return true;
  }

  private open(): void {
    if (this.socket)
      return;
    if (this.reopenTimer) {
      clearTimeout(this.reopenTimer);
      this.reopenTimer = null;
    }

    const socket = this.realtimeSockets.open('/chat');
    this.socket = socket;

    socket.addEventListener('message', (event) => this.onMessage(event));
    socket.addEventListener('close', () => {
      if (this.socket !== socket) // Close events can arrive late; ignore sockets that were already replaced
        return;

      this.socket = null;
      this._ready.set(false);

      this.reopenTimer = setTimeout(() => { // Covers 4401 auth closes, network drops, and backend restarts
        this.reopenTimer = null;
        if (this.auth.accessToken())
          this.open();  // No token means the user logged out and it should not be reopened: RealtimeSockets closed the socket on purpose
      }, REOPEN_DELAY_MS);
    });
  }

  private onMessage(event: MessageEvent): void {
    let parsed: { event?: string; data?: unknown };
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return;
    }

    switch (parsed.event) {
      case 'authenticated':
        this._ready.set(true);
        break;
      case 'message':
        this.messageSubject.next(parsed.data as MessageResponseDto);
        break;
      case 'error':
        this.errorSubject.next((parsed.data as { message?: string })?.message ?? 'UNKNOWN');
        break;
    }
  }
}
