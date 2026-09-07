import { Injectable } from '@nestjs/common';
import { GameEntity } from './game.entity';
import { GamesRepository } from './games.repository';

@Injectable()
export class GamesService {
    constructor(private readonly gamesRepository: GamesRepository) {
    }

    listGames(): Promise<GameEntity[]> {
        return this.gamesRepository.findAll();
    }
}
