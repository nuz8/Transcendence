import { Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { GameSocket } from '../game-socket';

type Mark = 'X' | 'O';
type RoundOutcome = 'win' | 'lose' | 'draw';
type MatchOutcome = RoundOutcome | 'forfeit'; // 'forfeit': ran out of time or quit, sent only to that player

@Component({
  imports: [MatCardModule],
  selector: 'app-ttt',
  styleUrl: './ttt.css',
  templateUrl: './ttt.html',
})
export class Ttt {
  private readonly gameSocket = inject(GameSocket);

  readonly gameId = input.required<string>();

  protected readonly board = signal<(Mark | null)[]>(Array(9).fill(null));
  protected readonly symbol = signal<Mark | null>(null);
  protected readonly yourTurn = signal(false);
  protected readonly reviewing = signal(false);
  protected readonly roundOutcome = signal<RoundOutcome | null>(null);
  protected readonly ownScore = signal(0);
  protected readonly opScore = signal(0);
  protected readonly matchOver = signal(false);
  protected readonly matchOutcome = signal<MatchOutcome | null>(null);

  protected readonly roundTimeLeft = this.gameSocket.roundTimeLeft;

  constructor() {
    this.gameSocket.messages$.pipe(takeUntilDestroyed()).subscribe((message) => this.onMessage(message));
  }

  protected move(cell: number): void {
    if (!this.yourTurn() || this.reviewing() || this.matchOver() || this.board()[cell] !== null)
      return;
    this.gameSocket.send('move', cell);
  }

  private onMessage(message: { event: string; data: Record<string, unknown> }): void {
    const data = message.data;
    switch (message.event) {
      case 'matched':
      case 'joined':
        this.symbol.set(data['symbol'] as Mark);
        this.board.set(data['board'] as (Mark | null)[]);
        this.yourTurn.set(data['yourTurn'] as boolean);
        this.gameSocket.setRoundTimeLeft(data['roundTimeLeft']);
        this.ownScore.set((data['ownScore'] as number) ?? 0);
        this.opScore.set((data['opScore'] as number) ?? 0);
        this.reviewing.set(false);
        this.roundOutcome.set(null);
        break;
      case 'moved':
        this.board.set(data['board'] as (Mark | null)[]);
        this.yourTurn.set(data['yourTurn'] as boolean);
        this.gameSocket.setRoundTimeLeft(data['roundTimeLeft']);
        break;
      case 'round':
        this.board.set(data['board'] as (Mark | null)[]);
        this.yourTurn.set(false);
        this.reviewing.set(true);
        this.roundOutcome.set(data['outcome'] as RoundOutcome);
        this.ownScore.set(data['ownScore'] as number);
        this.opScore.set(data['opScore'] as number);
        this.gameSocket.setRoundTimeLeft(null);
        break;
      case 'next_round':
        this.board.set(data['board'] as (Mark | null)[]);
        this.yourTurn.set(data['yourTurn'] as boolean);
        this.gameSocket.setRoundTimeLeft(data['roundTimeLeft']);
        this.reviewing.set(false);
        this.roundOutcome.set(null);
        break;
      case 'over':
        this.yourTurn.set(false);
        this.gameSocket.setRoundTimeLeft(null);
        this.ownScore.set(data['ownScore'] as number);
        this.opScore.set(data['opScore'] as number);
        this.matchOver.set(true);
        this.matchOutcome.set(data['outcome'] as MatchOutcome);
        break;
    }
  }
}
