import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameRepository } from './game.repository';
import { GameService } from './game.service';
import { MatchService } from './match/match.service';
import { AuthModule } from '../auth';
import { GameSettingsController } from './settings/game-settings.controller';
import { GameSettingsService } from './settings/game-settings.service';
import { GameSettingsRepository } from './settings/game-settings.repository';

@Module({
    imports: [AuthModule],
    controllers: [GameController, GameSettingsController],
    providers: [GameService, GameRepository, MatchService, GameSettingsService, GameSettingsRepository],
    exports: [GameService, MatchService, GameSettingsService],
})
export class GameModule {}