import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { GameSettings } from '../game-settings/game-settings';
import { RPS_GAME_ID } from '../game-ids';

@Component({
  imports: [MatCardModule, GameSettings],
  selector: 'app-rps',
  styleUrl: './rps.css',
  templateUrl: './rps.html',
})
export class Rps {
  protected readonly gameId = RPS_GAME_ID;
}
