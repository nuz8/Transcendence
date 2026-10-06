import { applyDecorators } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GameSettingsResponseDto } from './dto/game-settings-response.dto';

export function ApiGameSettingsController() {
    return applyDecorators(
        ApiTags('games'),
        ApiBearerAuth('access-token'),
    );
}

export function ApiGetGameSettings() {
    return applyDecorators(
        ApiOperation({ summary: "Get the current user's settings for a game, or the defaults" }),
        ApiOkResponse({ type: GameSettingsResponseDto }),
        ApiBadRequestResponse({ description: 'The game id is not a UUID.' }),
        ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
        ApiNotFoundResponse({ description: 'Game not found.' }),
    );
}

export function ApiPutGameSettings() {
    return applyDecorators(
        ApiOperation({ summary: "Save the current user's settings for a game" }),
        ApiOkResponse({ type: GameSettingsResponseDto }),
        ApiBadRequestResponse({ description: 'Invalid game id, target, mode, theme or powerUps.' }),
        ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
        ApiNotFoundResponse({ description: 'Game not found.' }),
    );
}
