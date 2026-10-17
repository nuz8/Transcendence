import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { GameSettingsResponseDto } from '../../../core/modules/openapi';
import { GameSettingsService } from '../../../core/services/game-settings.service';
import { GameSocket, type GatewayMessage } from '../game-socket';

const MOVES = ['rock', 'paper', 'scissors'] as const;
type Move = (typeof MOVES)[number];
const POWER_UPS = ['shield', 'double'] as const;
type PowerUp = (typeof POWER_UPS)[number];
type RoundOutcome = 'win' | 'lose' | 'draw';
type MatchOutcome = RoundOutcome | 'forfeit'; // 'forfeit': ran out of time or quit, sent only to that player

type LastRound = {
  ownMove: Move;
  opMove: Move;
  outcome: RoundOutcome;
  ownPowerUp: PowerUp | null;
  opPowerUp: PowerUp | null;
};

// Moves shown when the 'extra' theme is active.
const MOVE_EMOJIS: Record<Move, string> = { rock: '🪨', paper: '📄', scissors: '✂️' };

@Component({
  imports: [MatButtonModule, MatCardModule],
  selector: 'app-rps',
  styleUrl: './rps.css',
  templateUrl: './rps.html',
})
export class Rps implements OnInit {
  private readonly gameSocket = inject(GameSocket);
  private readonly gameSettingsService = inject(GameSettingsService);

  readonly gameId = input.required<string>();

  protected readonly moves = MOVES;

  protected readonly ownScore = signal(0);
  protected readonly opScore = signal(0);
  protected readonly powerUps = signal(false);
  protected readonly powerUpsLeft = signal<PowerUp[]>([]);
  protected readonly moved = signal(false);
  protected readonly pendingPowerUp = signal<PowerUp | null>(null);
  protected readonly lastRound = signal<LastRound | null>(null);
  protected readonly matchOver = signal(false);
  protected readonly matchOutcome = signal<MatchOutcome | null>(null);
  private readonly theme = signal<GameSettingsResponseDto.ThemeEnum>(GameSettingsResponseDto.ThemeEnum.Default);

  protected readonly roundTimeLeft = this.gameSocket.roundTimeLeft;

  // A shield on either side blocks scoring, so the round's winner never actually gets the point.
  protected readonly shielded = computed(() => {
    const last = this.lastRound();
    return last !== null && (last.ownPowerUp === 'shield' || last.opPowerUp === 'shield');
  });

  constructor() {
    this.gameSocket.messages$.pipe(takeUntilDestroyed()).subscribe((message) => this.onMessage(message));
  }

  ngOnInit(): void {
    this.gameSettingsService.getSettings(this.gameId()).subscribe((settings) => this.theme.set(settings.theme));
  }

  protected play(move: Move): void {
    if (this.moved() || this.matchOver())
      return;
    this.moved.set(true);
    this.gameSocket.send('move', move);
  }

  protected usePowerUp(powerUp: PowerUp): void {
    if (this.moved() || this.pendingPowerUp() || this.matchOver())
      return;
    this.pendingPowerUp.set(powerUp);
    this.gameSocket.send('power-up', powerUp);
  }

  // The queue ignores the theme, so moves are relabelled purely for display.
  protected moveLabel(move: Move): string {
    return this.theme() === 'extra' ? MOVE_EMOJIS[move] : move;
  }

  private onMessage(message: GatewayMessage): void {
    const data = message.data;
    switch (message.event) {
      case 'matched':
        this.powerUps.set((data['powerUps'] as boolean) ?? false);
        this.powerUpsLeft.set(this.powerUps() ? [...POWER_UPS] : []);
        this.ownScore.set(0);
        this.opScore.set(0);
        this.moved.set(false);
        this.pendingPowerUp.set(null);
        this.lastRound.set(null);
        this.matchOver.set(false);
        this.gameSocket.setRoundTimeLeft(data['roundTimeLeft']);
        break;
      case 'joined':
        this.powerUps.set((data['powerUps'] as boolean) ?? false);
        this.powerUpsLeft.set((data['powerUpsLeft'] as PowerUp[]) ?? []);
        this.ownScore.set((data['ownScore'] as number) ?? 0);
        this.opScore.set((data['opScore'] as number) ?? 0);
        this.moved.set((data['moved'] as boolean) ?? false);
        this.pendingPowerUp.set((data['powerUp'] as PowerUp | null) ?? null);
        this.lastRound.set(null);
        this.matchOver.set(false);
        this.gameSocket.setRoundTimeLeft(data['roundTimeLeft']);
        break;
      case 'waiting':
        this.moved.set(true);
        break;
      case 'powerup_accepted':
        this.pendingPowerUp.set(data['powerUp'] as PowerUp);
        break;
      case 'round': {
        const ownPowerUp = (data['ownPowerUp'] as PowerUp | null) ?? null;
        this.lastRound.set({
          ownMove: data['ownMove'] as Move,
          opMove: data['opMove'] as Move,
          outcome: data['outcome'] as RoundOutcome,
          ownPowerUp,
          opPowerUp: (data['opPowerUp'] as PowerUp | null) ?? null,
        });
        this.ownScore.set(data['ownScore'] as number);
        this.opScore.set(data['opScore'] as number);
        this.moved.set(false);
        this.pendingPowerUp.set(null);
        if (ownPowerUp)
          this.powerUpsLeft.update((left) => left.filter((powerUp) => powerUp !== ownPowerUp));
        this.gameSocket.setRoundTimeLeft(data['roundTimeLeft']);
        break;
      }
      case 'over':
        this.ownScore.set(data['ownScore'] as number);
        this.opScore.set(data['opScore'] as number);
        this.matchOver.set(true);
        this.matchOutcome.set(data['outcome'] as MatchOutcome);
        this.gameSocket.setRoundTimeLeft(null);
        break;
    }
  }
}
