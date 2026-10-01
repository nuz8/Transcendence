import { Module, OnModuleInit } from '@nestjs/common';
import { GameModule, GameService } from '..';
import { RPS_GAME_ID, RPS_GAME_NAME } from './rps.constants';
import { RpsGateway } from './rps.gateway';
import { RpsService } from './rps.service';
import { AuthModule } from '../../auth/auth.module';
import { ScoreModule } from '../../scores'
import { GamificationModule } from '../../gamification';
import { PresenceModule } from '../../presence/presence.module';

@Module({
    imports: [AuthModule, ScoreModule, GameModule, GamificationModule, PresenceModule],
    providers: [RpsService, RpsGateway],
})
export class RpsModule implements OnModuleInit {
    constructor(private readonly gameService: GameService) {}

    async onModuleInit(): Promise<void> {
        await this.gameService.ensureExists(RPS_GAME_ID, RPS_GAME_NAME);
    }
}
