import { Component } from '@angular/core';
import { GameList } from '../game-list/game-list';
import { Leaderboard } from '../leaderboard/leaderboard';

@Component({
  imports: [GameList, Leaderboard],
  selector: 'app-home',
  styles: `
    .home-content {
      max-width: 600px;
      margin: 1rem auto;
    }
    app-game-list {
      display: block;
      margin-bottom: 1.5rem;
    }
  `,
  template: `
    <div class="home-content">
      <app-game-list />
      <app-leaderboard />
    </div>
  `,
})
export class Home {}
