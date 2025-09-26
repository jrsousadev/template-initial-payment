import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

const ERROR_SCHEMAS = {
  BAD_REQUEST: {
    type: 'object',
    properties: {
      statusCode: { type: 'number', example: 400 },
      message: {
        oneOf: [
          { type: 'string', example: 'Bad Request' },
          {
            type: 'array',
            items: { type: 'string' },
            example: ['email must be a valid email', 'password is too weak'],
          },
        ],
      },
      error: { type: 'string', example: 'Bad Request' },
    },
  },
  UNAUTHORIZED: {
    type: 'object',
    properties: {
      statusCode: { type: 'number', example: 401 },
      message: { type: 'string', example: 'Unauthorized' },
      error: { type: 'string', example: 'Unauthorized' },
    },
  },
  FORBIDDEN: {
    type: 'object',
    properties: {
      statusCode: { type: 'number', example: 403 },
      message: { type: 'string', example: 'Forbidden' },
      error: { type: 'string', example: 'Forbidden' },
    },
  },
  CONFLICT: {
    type: 'object',
    properties: {
      statusCode: { type: 'number', example: 409 },
      message: { type: 'string', example: 'Conflict' },
      error: { type: 'string', example: 'Conflict' },
    },
  },
  PAYLOAD_TOO_LARGE: {
    type: 'object',
    properties: {
      statusCode: { type: 'number', example: 413 },
      message: { type: 'string', example: 'File too large' },
      error: { type: 'string', example: 'Payload Too Large' },
    },
  },
  NOT_FOUND: {
    type: 'object',
    properties: {
      statusCode: { type: 'number', example: 404 },
      message: { type: 'string', example: 'Resource not found' },
      error: { type: 'string', example: 'Not Found' },
    },
  },
};

export function CommonAuthErrors(
  options: {
    includeBadRequest?: boolean;
    includeUnauthorized?: boolean;
    includeForbidden?: boolean;
    includeConflict?: boolean;
    includePayloadTooLarge?: boolean;
    includeNotFound?: boolean;
    customMessages?: {
      badRequest?: string;
      unauthorized?: string;
      forbidden?: string;
      conflict?: string;
      payloadTooLarge?: string;
      notFound?: string;
    };
  } = {},
) {
  const {
    includeBadRequest = true,
    includeUnauthorized = true,
    includeForbidden = false,
    includeConflict = false,
    includePayloadTooLarge = false,
    includeNotFound = false,
    customMessages = {},
  } = options;

  const decorators: (MethodDecorator & ClassDecorator)[] = [];

  if (includeBadRequest) {
    decorators.push(
      ApiResponse({
        status: 400,
        description:
          customMessages.badRequest ||
          'Invalid request data or validation errors',
        schema: ERROR_SCHEMAS.BAD_REQUEST,
      }),
    );
  }

  if (includeUnauthorized) {
    decorators.push(
      ApiResponse({
        status: 401,
        description:
          customMessages.unauthorized ||
          'Unauthorized - Invalid or missing token',
        schema: ERROR_SCHEMAS.UNAUTHORIZED,
      }),
    );
  }

  if (includeForbidden) {
    decorators.push(
      ApiResponse({
        status: 403,
        description: customMessages.forbidden || 'Forbidden - Access denied',
        schema: ERROR_SCHEMAS.FORBIDDEN,
      }),
    );
  }

  if (includeConflict) {
    decorators.push(
      ApiResponse({
        status: 409,
        description:
          customMessages.conflict || 'Conflict - Resource already exists',
        schema: ERROR_SCHEMAS.CONFLICT,
      }),
    );
  }

  if (includePayloadTooLarge) {
    decorators.push(
      ApiResponse({
        status: 413,
        description:
          customMessages.payloadTooLarge || 'File too large (max 5MB per file)',
        schema: ERROR_SCHEMAS.PAYLOAD_TOO_LARGE,
      }),
    );
  }

  if (includeNotFound) {
    decorators.push(
      ApiResponse({
        status: 404,
        description: customMessages.notFound || 'Resource not found',
        schema: ERROR_SCHEMAS.NOT_FOUND,
      }),
    );
  }

  return applyDecorators(...decorators);
}

export function PublicAuthErrors(customMessages?: {
  badRequest?: string;
  unauthorized?: string;
  forbidden?: string;
  conflict?: string;
}) {
  return CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    includeConflict: true,
    customMessages,
  });
}

export function ProtectedAuthErrors(customMessages?: {
  badRequest?: string;
  unauthorized?: string;
  forbidden?: string;
}) {
  return CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages,
  });
}

export function FileUploadAuthErrors(customMessages?: {
  badRequest?: string;
  unauthorized?: string;
  payloadTooLarge?: string;
}) {
  return CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includePayloadTooLarge: true,
    customMessages,
  });
}
