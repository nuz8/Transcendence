import { Controller, Get } from '@nestjs/common';
import { GameService } from './game.service';
import { GameResponseDto } from './dto/game-response.dto';
import { ApiGamesController, ApiGetGames } from './game-api.decorators';

@ApiGamesController()
@Controller('games')
export class GameController {
    constructor(
        private readonly gameService: GameService
    ) {}

    @Get()
    @ApiGetGames()
    async listGames(): Promise<GameResponseDto[]> {
        return (await this.gameService.listGames()).map((game) => game.toPublicData());
    }
}