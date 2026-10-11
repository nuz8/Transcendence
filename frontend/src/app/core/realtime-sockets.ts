import { InjectionToken, Injectable, effect, inject } from '@angular/core';
import { Auth } from './auth';
import { getSocketUrl } from './socket-url';

// Lets tests replace the real WebSocket with a fake one.
export const WEB_SOCKET_FACTORY = new InjectionToken<(url: string) => WebSocket>('WEB_SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url: string) => new WebSocket(url),
});

@Injectable({ providedIn: 'root' })
export class RealtimeSockets {
  private readonly auth = inject(Auth);
  private readonly createSocket = inject(WEB_SOCKET_FACTORY);
  private readonly sockets = new Set<WebSocket>();

  constructor() {
    // Runs on every new access token: the backend renews open sockets in place. On logout, no socket outlives its user.
    effect(() => {
      const token = this.auth.accessToken();
      for (const socket of this.sockets) {
        if (!token) {
          socket.close();
        } else if (socket.readyState === WebSocket.OPEN) {
          this.sendAuth(socket, token);
        }
      }
    });
  }

  // Opens an authenticated socket on the backend, e.g. open('/games/rps') or open('/chat').
  open(path: string): WebSocket {
    const socket = this.createSocket(getSocketUrl(path));
    this.sockets.add(socket);

    socket.addEventListener('open', () => {
      const token = this.auth.accessToken();
      if (token) {
        this.sendAuth(socket, token);
      }
    });
    socket.addEventListener('close', () => this.sockets.delete(socket));

    return socket;
  }

  private sendAuth(socket: WebSocket, token: string): void {
    socket.send(JSON.stringify({ event: 'auth', data: { token } }));
  }
}
