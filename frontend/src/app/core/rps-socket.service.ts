import { inject, Injectable, isDevMode, signal } from "@angular/core";
import { RealtimeSockets } from "./realtime-sockets";

@Injectable({ providedIn: 'root' })
export class RpsSocketService {
  private readonly realtimeSockets = inject(RealtimeSockets);
  private ws: WebSocket | null = null;
  readonly connected = signal(false);

  connect(): WebSocket {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return this.ws;
    }
    
    this.ws = this.realtimeSockets.open('/games/rps');

    // Expose to window for testing in the browser DevTools console
    if (isDevMode()) {
      (window as any).rpsSocket = this.ws;
      (window as any).sendRps = (event: string, data: any = {}) => {
        this.ws?.send(JSON.stringify({ event, data }));
      };
    }

    this.ws.addEventListener('open', () => {
      this.connected.set(true);      
      console.log('RPS WebSocket connected to: ', this.ws?.url);
    });

    this.ws.addEventListener('message', (event) => {
      console.log('RPS WebSocket message:', JSON.parse(event.data));
    });

    this.ws.addEventListener('close', (event) => {
      this.connected.set(false);
      console.log('RPS WebSocket closed:', event.code, event.reason);
      this.ws = null;
    });

    return this.ws;
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.connected.set(false);
  }
}