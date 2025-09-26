import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export function ApiKeyHeaders() {
  return applyDecorators(
    ApiHeader({
      name: 'x-api-key-public',
      description: 'Public API key for authentication',
      required: true,
      example: 'pk_live_1234567890abcdef',
    }),
    ApiHeader({
      name: 'x-api-key-secret',
      description: 'Secret API key for authentication',
      required: true,
      example: 'sk_live_abcdef1234567890',
    }),
  );
}
