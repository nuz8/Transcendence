import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiSecurity, ApiTooManyRequestsResponse } from '@nestjs/swagger';

export const API_KEY_ACCESS = 'apiKeyAccess';

export function ApiKeyAccess() {
    return applyDecorators(
        SetMetadata(API_KEY_ACCESS, true),
        ApiSecurity('api-key'),
        ApiTooManyRequestsResponse({ description: 'Too many requests with this API key. Retry after time in the Retry-After header.' }),
    );
}
