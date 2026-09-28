import { applyDecorators } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { PublicUserResponseDto } from './dto/public-user-response.dto';

export function ApiUsersController() {
  return applyDecorators(
    ApiTags('users'),
    ApiBearerAuth('access-token'),
  );
}

export function ApiGetUsersSelf() {
  return applyDecorators(
    ApiOperation({ summary: 'Get the current user profile' }),
    ApiOkResponse({ type: PublicUserResponseDto }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiNotFoundResponse({ description: 'Authenticated user was not found.' }),
  );
}

export function ApiPatchUsersSelf() {
  return applyDecorators(
    ApiOperation({ summary: 'Update the current user profile' }),
    ApiOkResponse({ type: PublicUserResponseDto }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiBadRequestResponse({ description: 'The supplied username is invalid.' }),
    ApiNotFoundResponse({ description: 'User not found.' }),
    ApiConflictResponse({ description: 'The username is already in use.' }),
  );
}

export function ApiPostUsersAvatar() {
  return applyDecorators(
    ApiOperation({ summary: 'Upload the current user avatar' }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      description: 'Avatar image. JPEG, PNG, or WEBP; maximum size 5 MB.',
      required: true,
      schema: {
        type: 'object',
        required: ['avatar'],
        properties: {
          avatar: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    }),
    ApiCreatedResponse({ type: PublicUserResponseDto }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiBadRequestResponse({
      description: 'Missing file, unsupported file type, or invalid image content.',
    }),
    ApiNotFoundResponse({ description: 'User not found.' }),
    ApiResponse({ status: 413, description: 'Avatar file exceeds the 5 MB limit.' }),
  );
}
