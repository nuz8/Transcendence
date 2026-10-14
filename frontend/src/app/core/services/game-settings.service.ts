import { inject, Service } from '@angular/core';
import { GameSettingsDto, GamesService, GameSettingsResponseDto } from '../modules/openapi';
import { Observable } from 'rxjs';

@Service()
export class GameSettingsService {
    private readonly gamesApiClient = inject(GamesService);

    getSettings(gameId: string): Observable<GameSettingsResponseDto> {
        return this.gamesApiClient.gameSettingsControllerRead({ gameId });
    }

    replaceSettings(gameId: string, settings: GameSettingsDto): Observable<GameSettingsResponseDto> {
        return this.gamesApiClient.gameSettingsControllerReplace({ gameId, gameSettingsDto: settings });
    }
}
