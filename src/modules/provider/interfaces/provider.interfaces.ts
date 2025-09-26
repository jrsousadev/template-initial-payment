import {
  provider_name,
  provider_model,
  provider_environment,
  provider_mode,
  provider_type,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProviderResponseDto {
  @ApiProperty({
    description: 'Provider ID',
    example: 'prv_cm3x7n8f70000vs6g5jkg5hkn',
  })
  id: string;

  @ApiProperty({
    description: 'Provider name',
    enum: provider_name,
    example: 'STRIPE',
  })
  name: provider_name;

  @ApiProperty({
    description: 'Provider type',
    enum: provider_type,
    example: 'PAYMENT_GATEWAY',
  })
  type: provider_type;

  @ApiProperty({
    description: 'Provider status',
    enum: ['ACTIVE', 'INACTIVE'],
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-12-23T10:00:00Z',
  })
  created_at: Date;
}

export class ProviderDetailsDto extends ProviderResponseDto {
  @ApiProperty({
    description: 'Provider model',
    enum: provider_model,
  })
  model: provider_model;

  @ApiProperty({
    description: 'Provider environment',
    enum: provider_environment,
  })
  environment: provider_environment;

  @ApiProperty({
    description: 'Provider mode',
    enum: provider_mode,
  })
  mode: provider_mode;

  @ApiPropertyOptional({
    description: 'Provider description',
    example: 'Stripe payment gateway integration',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Provider configuration',
    type: 'object',
    additionalProperties: false,
  })
  configuration?: object;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-12-23T10:00:00Z',
  })
  updated_at: Date;
}

export class ProviderUpdateResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Provider updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated provider information',
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      status: { type: 'string' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  })
  provider: {
    id: string;
    name: string;
    status: string;
    updated_at: Date;
  };
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;
}
