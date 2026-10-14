import { Component, OnInit, inject, input, signal } from '@angular/core';
import { GameSettingsService } from '../../../core/services/game-settings.service';
import { GameSettingsDto, GameSettingsResponseDto } from '../../../core/modules/openapi';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

type Choices = Omit<GameSettingsResponseDto, 'gameId'>;

@Component({
  imports: [MatButtonToggleModule, MatCardModule, MatFormFieldModule, MatSelectModule],
  selector: 'app-game-settings',
  styleUrl: './game-settings.css',
  templateUrl: './game-settings.html',
})
export class GameSettings implements OnInit {
    private readonly gameSettingsService = inject(GameSettingsService)
    readonly gameId = input.required<string>();
    readonly supportsPowerUps = input(true);
    protected readonly settings = signal<GameSettingsResponseDto | null>(null);
    protected readonly targets = Object.values(GameSettingsDto.TargetEnum);
    protected readonly modes = GameSettingsDto.ModeEnum;

    ngOnInit(): void {
        this.gameSettingsService.get(this.gameId()).subscribe((settings) => this.settings.set(settings));
        
    }

    protected save(current: GameSettingsResponseDto, change: Partial<Choices>): void {
        const { gameId, ...choices } = { ...current, ...change };
        this.settings.set({ gameId, ...choices });
        this.gameSettingsService.put(gameId, choices).subscribe({
            next: (saved) => this.settings.set(saved),
            error: () => this.settings.set(current),
        });
    }
}
