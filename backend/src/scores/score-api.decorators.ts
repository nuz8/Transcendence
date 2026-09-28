import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOkResponse,
  ApiOperation,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MatchHistoryResponseDto } from './dto/mh-response.dto';
import { UserStatsResponseDto } from './dto/user-stats-response.dto';

export function ApiScoresController() {
  return applyDecorators(
    ApiTags('scores'),
    ApiBearerAuth('access-token'),
  );
}

export function ApiUsersSelfMatches() {
  return applyDecorators(
    ApiOperation({ summary: 'Get match history of the current user' }),
    ApiOkResponse({ type: MatchHistoryResponseDto }),
    ApiBadRequestResponse({ description: 'The page or limit query is invalid.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
  );
}

export function ApiUsersSelfStats() {
  return applyDecorators(
    ApiOperation({ summary: 'Get match statistics of the current user' }),
    ApiOkResponse({ type: UserStatsResponseDto }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
  );
}