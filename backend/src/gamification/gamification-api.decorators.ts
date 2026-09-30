import { applyDecorators } from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiParam,
} from "@nestjs/swagger";
import { LeaderboardResponseDto } from "./dto/leaderboard-response.dto";
import { UserAchievementsResponseDto } from "./dto/user-achievements-response.dto";

export function ApiGamificationController() {
  return applyDecorators(
    ApiTags('gamification'),
    ApiBearerAuth('access-token'),
  );
}

export function ApiGetLeaderboard() {
  return applyDecorators(
    ApiOperation({ summary: 'Get the paginated leaderboard' }),
    ApiOkResponse({ type: LeaderboardResponseDto }),
    ApiBadRequestResponse({ description: 'The page or limit query is invalid.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
  );
}

export function ApiGetSelfAchievements() {
  return applyDecorators(
    ApiOperation({ summary: 'Get the current user’s achievement overview' }),
    ApiOkResponse({ type: UserAchievementsResponseDto }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiNotFoundResponse({ description: 'User not found.' }),
  );
}

export function ApiGetUserAchievements() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a user’s achievement overview' }),
    ApiOkResponse({ type: UserAchievementsResponseDto }),
    ApiParam({ name: 'id', format: 'uuid' }),
    ApiBadRequestResponse({ description: 'User ID is not a valid UUID.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiNotFoundResponse({ description: 'User not found.' }),
  );
}