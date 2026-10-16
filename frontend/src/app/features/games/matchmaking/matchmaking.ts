import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GameSocket } from '../game-socket';

@Component({
  imports: [MatButtonModule, MatCardModule, MatProgressSpinnerModule],
  selector: 'app-matchmaking',
  styleUrl: './matchmaking.css',
  templateUrl: './matchmaking.html',
})
export class Matchmaking {
  private readonly gameSocket = inject(GameSocket);

  protected readonly status = this.gameSocket.status;
  protected readonly unknownGame = this.gameSocket.unknownGame;

  protected queue(): void {
    this.gameSocket.queue();
  }

  protected leaveQueue(): void {
    this.gameSocket.leaveQueue();
  }
}

