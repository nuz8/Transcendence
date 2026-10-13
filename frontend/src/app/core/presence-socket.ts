import { Injectable, effect, inject, untracked } from '@angular/core';
import { Auth } from './auth';
import { RealtimeSockets } from './realtime-sockets';

const REOPEN_DELAY_MS = 5_000;

@Injectable({ providedIn: 'root' })
export class PresenceSocket {
    private readonly auth = inject(Auth);
    private readonly realtimeSockets = inject(RealtimeSockets);
    private socket: WebSocket | null = null;

    constructor(){
        effect(() => {
            if (this.auth.accessToken()) {
                untracked(() => this.open());
            }
        });
    }

    private open(): void {
        if (this.socket) {
            return ;
        }
        const socket = this.realtimeSockets.open('/chat');
        this.socket = socket;
        socket.addEventListener('close', () => {
            this.socket = null;
            setTimeout(() => {
                if (this.auth.accessToken()) {
                    this.open();
                }
            }, REOPEN_DELAY_MS);
        });
    }
}