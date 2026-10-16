import { Component, OnInit, computed, inject, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { GameSettings } from '../game-settings/game-settings';
import { GameSocket } from '../game-socket';
import { Matchmaking } from '../matchmaking/matchmaking';
import { GAME_COMPONENTS, GAME_NAMES, GAME_SUPPORTS_POWER_UPS } from '../game.constants';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  imports: [GameSettings, Matchmaking, MatButtonModule, MatCardModule, NgComponentOutlet],
  providers: [GameSocket],
  selector: 'app-game-container',
  styleUrl: './game-container.css',
  templateUrl: './game-container.html',
})
export class GameContainer implements OnInit {
  // Owns the game's websocket for this route so matchmaking, settings and the gameplay component can share it.
  private readonly gameSocket = inject(GameSocket);

  readonly gameId = input.required<string>();

  protected readonly status = this.gameSocket.status;

  gameplayComponent = computed(
    () => GAME_COMPONENTS[this.gameId()] ?? null
  );

  gameName = computed(() => GAME_NAMES[this.gameId()] ?? '');

  supportsPowerUps = computed(() => GAME_SUPPORTS_POWER_UPS[this.gameId()] ?? true);

  ngOnInit(): void {
    this.gameSocket.init(this.gameId());
  }

  protected quit(): void {
    this.gameSocket.quit();
  }
}
