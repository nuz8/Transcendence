import { applyDecorators } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

export function ApiAppController() {
  return applyDecorators(ApiTags('app'));
}

export function ApiGetRoot() {
  return applyDecorators(
    ApiOperation({ summary: 'Root Endpoint' }),
    ApiOkResponse({
      type: String,
      description: 'Currently only returns a greeting string.',
      example: 'Hello World!',
    }),
  );
}