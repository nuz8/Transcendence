import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PublicUserResponseDto } from '../users/dto/public-user-response.dto';
import {
  LoginResponseDto,
  RefreshResponseDto,
  LogoutResponseDto,
} from './dto/auth-response.dto';

export function ApiAuthController() {
  return applyDecorators(ApiTags('auth'));
}

export function ApiPostAuthLogin() {
  return applyDecorators(
    ApiOperation({ summary: 'Log in and receive authentication tokens' }),
    ApiOkResponse({ type: LoginResponseDto }),
    ApiBadRequestResponse({ description: 'The login request is invalid.' }),
    ApiUnauthorizedResponse({ description: 'The email or password is invalid.' }),
  );
}

export function ApiPostAuthRefresh() {
  return applyDecorators(
    ApiOperation({ summary: 'Refresh the authentication tokens' }),
    ApiOkResponse({ type: RefreshResponseDto }),
    ApiBadRequestResponse({ description: 'The refresh-token request is invalid.' }),
    ApiUnauthorizedResponse({ description: 'The refresh token is invalid or expired.' }),
  );
}

export function ApiPostAuthRegister() {
  return applyDecorators(
    ApiOperation({ summary: 'Register a user account' }),
    ApiCreatedResponse({ type: PublicUserResponseDto }),
    ApiBadRequestResponse({ description: 'The registration details are invalid.' }),
    ApiConflictResponse({ description: 'The username or email is already in use.' }),
  );
}

export function ApiPostAuthLogout() {
	return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Log out and revoke the current tokens' }),
    ApiOkResponse({ type: LogoutResponseDto }),
    ApiBadRequestResponse({ description: 'The logout request is invalid.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
  );
}