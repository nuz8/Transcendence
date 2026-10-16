import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { GameSettingsService } from '../../../core/services/game-settings.service';
import { GameSettingsDto, GameSettingsResponseDto } from '../../../core/modules/openapi';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { GameSocket } from '../game-socket';

type Choices = Omit<GameSettingsResponseDto, 'gameId'>;

@Component({
  imports: [MatButtonToggleModule, MatButtonModule, MatExpansionModule, MatFormFieldModule, MatSelectModule],
  selector: 'app-game-settings',
  styleUrl: './game-settings.css',
  templateUrl: './game-settings.html',
})
export class GameSettings implements OnInit {
  private readonly gameSettingsService = inject(GameSettingsService)
  private readonly gameSocket = inject(GameSocket);

  readonly gameId = input.required<string>();
  readonly supportsPowerUps = input(true);
  protected readonly settings = signal<GameSettingsResponseDto | null>(null);
  protected readonly targets = Object.values(GameSettingsDto.TargetEnum);
  protected readonly modes = GameSettingsDto.ModeEnum;
  protected readonly expanded = signal(false);
  // Settings can't be changed once a match is being searched for.
  protected readonly locked = computed(() => this.gameSocket.status() === 'queueing');

  // Shown in the collapsed panel header as a quick-glance summary.
  protected readonly summary = computed(() => {
    const current = this.settings();
    if (!current)
      return '';

    const target = current.mode === this.modes.FixedRounds
      ? `${current.target} rounds`
      : `First to ${current.target}`;
    const powerUps = this.supportsPowerUps() ? (current.powerUps ? 'Power-ups on' : 'Power-ups off') : null;

    return [target, powerUps].filter(Boolean).join(' & ');
  });

  constructor() {
    effect(() => {
      if (this.locked())
        this.expanded.set(false);
    });
  }

  ngOnInit(): void {
    this.gameSettingsService.getSettings(this.gameId()).subscribe((settings) => this.settings.set(settings));
  }

  protected save(current: GameSettingsResponseDto, change: Partial<Choices>): void {
    const { gameId, ...choices } = { ...current, ...change };
    this.settings.set({ gameId, ...choices });
    this.gameSettingsService.replaceSettings(gameId, choices).subscribe({
      next: (saved) => this.settings.set(saved),
      error: () => this.settings.set(current),
    });
  }
}
