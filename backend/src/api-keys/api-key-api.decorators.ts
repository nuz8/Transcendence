import { applyDecorators } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiConflictResponse,
	ApiCreatedResponse,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyResponseDto, CreatedApiKeyResponseDto } from './dto/api-key-response.dto';

export function ApiApiKeysController() {
	return applyDecorators(
		ApiTags('api-keys'),
		ApiBearerAuth('access-token'),
	);
}

export function ApiPostApiKey() {
	return applyDecorators(
		ApiOperation({ summary: 'Create an API key', description: 'The key is returned once. Send it in the X-API-Key header on the routes that accept one.' }),
		ApiCreatedResponse({ type: CreatedApiKeyResponseDto }),
		ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
		ApiConflictResponse({ description: 'The user already has the maximum number of keys.' }),
	);
}

export function ApiGetApiKeys() {
	return applyDecorators(
		ApiOperation({ summary: "List the current user's API keys" }),
		ApiOkResponse({ type: [ApiKeyResponseDto] }),
		ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
	);
}

export function ApiDeleteApiKey() {
	return applyDecorators(
		ApiOperation({ summary: 'Revoke an API key' }),
		ApiParam({ name: 'id', format: 'uuid' }),
		ApiNoContentResponse({ description: 'The key was revoked.' }),
		ApiBadRequestResponse({ description: 'Key ID is not a valid UUID.' }),
		ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
		ApiNotFoundResponse({ description: 'The key does not exist or belongs to another user.' }),
	);
}
