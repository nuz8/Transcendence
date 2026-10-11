import { Body, Controller, Param, ParseUUIDPipe, Put, Req, UseGuards, Get } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { GameSettingsService } from './game-settings.service';
import { GameSettingsDto } from './dto/game-settings.dto';
import { GameSettingsResponseDto } from './dto/game-settings-response.dto';
import { ApiGameSettingsController, ApiGetGameSettings, ApiPutGameSettings } from './game-settings-api.decorators';
import { ApiKeyAccess, AuthOrApiKeyGuard, ApiKeyThrottlerGuard } from '../../api-keys';

@ApiGameSettingsController()
@Controller('users/self/games')
export class GameSettingsController {
    constructor(private readonly gameSettingsService: GameSettingsService) {}

    @UseGuards(AuthGuard)
    @Get(':gameId/settings')
    @ApiGetGameSettings()
    async read(
        @Req() req: { user: { sub: string } },
        @Param('gameId', ParseUUIDPipe) gameId: string,
    ): Promise<GameSettingsResponseDto> {
        return (await this.gameSettingsService.current(req.user.sub, gameId)).toPublicData();
    }

    @UseGuards(AuthOrApiKeyGuard, ApiKeyThrottlerGuard)
    @ApiPutGameSettings()
    @ApiKeyAccess()
    @Put(':gameId/settings')
    async replace(
        @Req() req: { user: { sub: string } },
        @Param('gameId', ParseUUIDPipe) gameId: string,
        @Body() body: GameSettingsDto,

    ): Promise<GameSettingsResponseDto> {
        return (await this.gameSettingsService.save(req.user.sub, gameId, body)).toPublicData();
    }
}
