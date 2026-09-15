import { Module } from '@nestjs/common';
import { ScoreRepository } from './score.repository';
import { AuthModule } from '../auth';
import { ScoreController } from './score.controller';
import { ScoreService } from './score.service';
import { GameModule } from '../games/game.module';

@Module({
    imports: [AuthModule, GameModule],
    controllers: [ScoreController],
    providers: [ScoreService, ScoreRepository],
    exports: [ScoreRepository],
})
export class ScoreModule {}