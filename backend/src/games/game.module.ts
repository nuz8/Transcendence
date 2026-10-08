import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameRepository } from './game.repository';
import { GameService } from './game.service';
import { MatchService } from './match/match.service';
import { AuthModule } from '../auth';
import { GameSettingsController } from './settings/game-settings.controller';
import { GameSettingsService } from './settings/game-settings.service';
import { GameSettingsRepository } from './settings/game-settings.repository';
import { ActiveMatchService } from './gateway-utils/active-match.service';

@Module({
    imports: [AuthModule],
    controllers: [GameController, GameSettingsController],
    providers: [GameService, GameRepository, MatchService, GameSettingsService, GameSettingsRepository, ActiveMatchService],
    exports: [GameService, MatchService, GameSettingsService, ActiveMatchService],
})
export class GameModule {}