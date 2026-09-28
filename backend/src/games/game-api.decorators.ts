import { applyDecorators } from "@nestjs/common";
import { GameResponseDto } from "./dto/game-response.dto";
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";

export function ApiGamesController() {
  return applyDecorators(ApiTags('games'));
}

export function ApiGetGames() {
  return applyDecorators(
    ApiOperation({ summary: 'List available games' }),
    ApiOkResponse({ type: [GameResponseDto] }),
  );
}