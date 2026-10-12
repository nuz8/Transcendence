import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { GamesService } from '../../core/modules/openapi';
import { Router } from '@angular/router';

@Component({
  imports: [AsyncPipe, MatButtonModule, MatCardModule],
  selector: 'app-game-list',
  styleUrl: './game-list.css',
  templateUrl: './game-list.html',
})
export class GameList {
  private readonly gamesService = inject(GamesService);
  private readonly router = inject(Router);

  protected readonly games$ = this.gamesService.gameControllerListGames();

  onClick(gameId: string): void {
    void this.router.navigate(['/games', gameId]);
  }
}
