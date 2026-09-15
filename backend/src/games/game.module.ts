import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameRepository } from './game.repository';
import { GameService } from './game.service';
import { MatchService } from './match/match.service';

@Module({
    controllers: [GameController],
    providers: [GameService, GameRepository, MatchService],
    exports: [GameService, MatchService],
})
export class GameModule {}