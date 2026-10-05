import { applyDecorators } from "@nestjs/common";
import { OnlineStatusResponseDto } from "./dto/online-status-response.dto";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from "@nestjs/swagger";

export function ApiPresenceController() {
  return applyDecorators(
    ApiTags('presence'),
    ApiBearerAuth('access-token'),
  );
}

export function ApiGetUserOnlineStatus() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a user’s online status',
      description: 'Available to the user themselves or an accepted friend.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID of the target user.',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOkResponse({ type: OnlineStatusResponseDto }),
    ApiBadRequestResponse({ description: 'The id is not a valid UUID.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiForbiddenResponse({ description: 'The caller is not the target user or an accepted friend.' }),
  );
}