import { ApiProperty } from '@nestjs/swagger';

// Swagger Response DTOs
export class ApiKeyPermissionsDto {
  @ApiProperty({ type: 'boolean' })
  WRITE_PAYMENT: boolean;

  @ApiProperty({ type: 'boolean' })
  READ_PAYMENT: boolean;

  @ApiProperty({ type: 'boolean' })
  REFUND_PAYMENT: boolean;

  @ApiProperty({ type: 'boolean' })
  WRITE_WITHDRAWAL: boolean;

  @ApiProperty({ type: 'boolean' })
  READ_WITHDRAWAL: boolean;
}

export class ApiKeyResponseDto {
  @ApiProperty({
    type: 'string',
    example: 'key_1234567890',
    description: 'API key identifier',
  })
  id: string;

  @ApiProperty({
    type: 'string',
    example: 'pk_live_1234567890abcdef',
    description: 'Public API key (safe to expose)',
  })
  public_key: string;

  @ApiProperty({
    type: 'string',
    example: 'sk_live_abcdef1234567890',
    description: 'Secret API key (keep secure)',
  })
  secret_key: string;

  @ApiProperty({
    type: 'string',
    example: 'Production API key for payment processing',
  })
  description: string;

  @ApiProperty({ type: ApiKeyPermissionsDto })
  permissions: ApiKeyPermissionsDto;

  @ApiProperty({ type: 'boolean', example: true })
  is_active: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  created_at: string;
}

export class ApiKeyListItemDto {
  @ApiProperty({ type: 'string', example: 'key_1234567890' })
  id: string;

  @ApiProperty({ type: 'string', example: 'pk_live_1234567890abcdef' })
  public_key: string;

  @ApiProperty({
    type: 'string',
    example: 'sk_live_****...****7890',
    description: 'Masked for security',
  })
  secret_key: string;

  @ApiProperty({
    type: 'string',
    example: 'Production API key for payment processing',
  })
  description: string;

  @ApiProperty({ type: ApiKeyPermissionsDto })
  permissions: ApiKeyPermissionsDto;

  @ApiProperty({ type: 'boolean' })
  is_active: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  created_at: string;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  last_used_at: string | null;
}

export class ApiKeyDetailsDto extends ApiKeyListItemDto {
  @ApiProperty({
    type: 'object',
    properties: {
      total_requests: { type: 'number', example: 1250 },
      last_30_days: { type: 'number', example: 89 },
    },
  })
  usage_stats: {
    total_requests: number;
    last_30_days: number;
  };
}

export class ApiKeyUpdateResponseDto {
  @ApiProperty({ type: 'string', example: 'key_1234567890' })
  id: string;

  @ApiProperty({ type: 'string', example: 'pk_live_1234567890abcdef' })
  public_key: string;

  @ApiProperty({
    type: 'string',
    example: 'sk_live_****...****7890',
    description: 'Masked for security',
  })
  secret_key: string;

  @ApiProperty({ type: 'string', example: 'Updated API key description' })
  description: string;

  @ApiProperty({ type: ApiKeyPermissionsDto })
  permissions: ApiKeyPermissionsDto;

  @ApiProperty({ type: 'boolean' })
  is_active: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at: string;
}

export class ApiKeyValidationDto {
  @ApiProperty({ type: 'boolean', example: true })
  valid: boolean;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'string', example: 'key_1234567890' },
      public_key: { type: 'string', example: 'pk_live_1234567890abcdef' },
      description: { type: 'string', example: 'Production API key' },
      permissions: { type: ApiKeyPermissionsDto },
      company_id: { type: 'string', example: 'comp_1234567890' },
      is_active: { type: 'boolean', example: true },
    },
  })
  api_key: {
    id: string;
    public_key: string;
    description: string;
    permissions: ApiKeyPermissionsDto;
    company_id: string;
    is_active: boolean;
  };
}

export class ApiKeyRegenerateResponseDto {
  @ApiProperty({ type: 'string', example: 'key_1234567890' })
  id: string;

  @ApiProperty({
    type: 'string',
    example: 'pk_live_newkey1234567890',
    description: 'New public key',
  })
  public_key: string;

  @ApiProperty({
    type: 'string',
    example: 'sk_live_newsecret1234567890',
    description: 'New secret key (store securely)',
  })
  secret_key: string;

  @ApiProperty({ type: 'string', example: 'Production API key' })
  description: string;

  @ApiProperty({ type: ApiKeyPermissionsDto })
  permissions: ApiKeyPermissionsDto;

  @ApiProperty({ type: 'boolean', example: true })
  is_active: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  regenerated_at: string;
}
