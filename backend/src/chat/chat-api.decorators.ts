import { applyDecorators } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MessageResponseDto } from './dto/message-response.dto';

export function ApiChatController() {
  return applyDecorators(
    ApiTags('chat'),
    ApiBearerAuth('access-token'),
  );
}

export function ApiGetChatPeer() {
  return applyDecorators(
    ApiOperation({ summary: 'Get the conversation with a friend' }),
    ApiOkResponse({ type: [MessageResponseDto] }),
    ApiParam({ name: 'peerId', format: 'uuid' }),
    ApiBadRequestResponse({ description: 'Peer ID is not a valid UUID.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiForbiddenResponse({ description: 'The current user is not friends with this peer.' }),
  );
}