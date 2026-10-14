import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { GameSettings } from '../game-settings/game-settings';
import { TTT_GAME_ID } from '../game-ids';

@Component({
  imports: [MatCardModule, GameSettings],
  selector: 'app-ttt',
  styleUrl: './ttt.css',
  templateUrl: './ttt.html',
})
export class Ttt {
  protected readonly gameId = TTT_GAME_ID;
}