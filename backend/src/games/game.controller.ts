import { Controller, Get } from '@nestjs/common';
import { GameService } from './game.service';

@Controller('games')
export class GameController {
    constructor(private readonly gameService: GameService) {

    }

    @Get()
    async listGames() {
        return (await this.gameService.listGames()).map((game) => game.toPublicData());
    }
}