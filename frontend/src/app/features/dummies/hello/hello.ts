import { Component, inject, OnDestroy, signal } from '@angular/core';
import { RpsSocketService } from '../../../core/rps-socket.service';

@Component({
  selector: 'app-hello',
  template: `
    <p>hello world!</p>
    <button (click)="connectSocket()" [disabled]="rpsSocket.connected()">
      {{ rpsSocket.connected() ? 'Socket Connected (Check Network/Console)' : 'Connect RPS Socket' }}
    </button>
  `,
})
export class Hello implements OnDestroy {
  readonly rpsSocket = inject(RpsSocketService);

  connectSocket(): void {
    this.rpsSocket.connect();
  }

  ngOnDestroy() {
    this.rpsSocket.disconnect();
  }
}
