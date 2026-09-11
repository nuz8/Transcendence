import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameRepository } from './game.repository';
import { GameService } from './game.service';

@Module({
    controllers: [GameController],
    providers: [GameService, GameRepository],
    exports: [GameService]
})
export class GameModule {}