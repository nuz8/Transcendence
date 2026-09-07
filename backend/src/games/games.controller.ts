import { Controller, Get } from '@nestjs/common';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
    constructor(private readonly gameService: GamesService) {

    }

    @Get()
    async listGames() {
        return (await this.gameService.listGames()).map((game) => game.toPublicData());
    }
}