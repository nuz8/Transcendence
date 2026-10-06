import { Injectable, NotFoundException } from '@nestjs/common';
import { GameSettingsEntity, type GameSettingsChoices } from './game-settings.entity';
import { GameSettingsRepository, UnknownGameError } from './game-settings.repository';
import { GameService } from '../game.service';
import { DEFAULT_GAME_SETTINGS } from './game-settings.constants';

@Injectable()
export class GameSettingsService {
    constructor(private readonly gameSettingsRepository: GameSettingsRepository, private readonly gameService: GameService) {}

    settingsFor(userId: string, gameId: string): Promise<GameSettingsEntity | null> {
        return this.gameSettingsRepository.findByUserAndGame(userId, gameId);
    }

    async current(userId: string, gameId: string): Promise<GameSettingsEntity> {
        const saved = await this.gameSettingsRepository.findByUserAndGame(userId, gameId);
        if (saved) {
            return saved;
        }

        const games = await this.gameService.listGames();
        if (!games.some((game) => game.id === gameId)) {
            throw new NotFoundException(`Game with id ${gameId} does not exist`);
        }

        return new GameSettingsEntity({ userId, gameId, ...DEFAULT_GAME_SETTINGS });
    }

    async save(userId: string, gameId: string, choices: GameSettingsChoices): Promise<GameSettingsEntity> {
        try {
            return await this.gameSettingsRepository.save(new GameSettingsEntity({ userId, gameId, ...choices }));
        } catch (err) {
            if (err instanceof UnknownGameError) {
                throw new NotFoundException(err.message);
            }
            throw err;
        }
    }
}