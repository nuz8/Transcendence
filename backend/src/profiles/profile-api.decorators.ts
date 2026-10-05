import { applyDecorators } from "@nestjs/common";
import { ProfileResponseDto, SelfProfileResponseDto } from "./dto/profile-response.dto";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from "@nestjs/swagger";

export function ApiProfileController() {
  return applyDecorators(
    ApiTags('users'),
    ApiBearerAuth('access-token'),
  );
}

export function ApiGetUserProfile() {
  return applyDecorators(
    ApiOperation({ summary: 'Get the public profile of a user from the specific requester POV' }),
    ApiOkResponse({ type: ProfileResponseDto }),
    ApiBadRequestResponse({ description: 'The id, page or limit is invalid.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiNotFoundResponse({ description: 'User not found or deleted.' }),
  );
}

export function ApiGetSelfProfile() {
  return applyDecorators(
    ApiOperation({ summary: 'Get the profile of the current user including email' }),
    ApiOkResponse({ type: SelfProfileResponseDto }),
    ApiBadRequestResponse({ description: 'The id, page or limit is invalid.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiNotFoundResponse({ description: 'Authenticated user was not found.' }),
  );
}

