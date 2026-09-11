import { Injectable } from '@nestjs/common';
import { GameEntity } from './game.entity';
import { GameRepository } from './game.repository';

@Injectable()
export class GameService {
    constructor(private readonly gameRepository: GameRepository) {
    }

    listGames(): Promise<GameEntity[]> {
        return this.gameRepository.findAll();
    }

    ensureExists(id: string, name:string): Promise<void> {
        return this.gameRepository.ensureExists(id, name);
    }
}
