// src/modules/api-key/dto/api-key.dto.ts
import {
  IsString,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Permission } from 'src/common/permissions/permissions.enum';

// Base class para permissões
export abstract class BasePermissionsDto {
  @ApiProperty({
    description: 'Allow creating payments',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  [Permission.WRITE_PAYMENT]?: boolean;

  @ApiProperty({
    description: 'Allow reading payments',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  [Permission.READ_PAYMENT]?: boolean;

  @ApiProperty({
    description: 'Allow refunding payments',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  [Permission.REFUND_PAYMENT]?: boolean;

  @ApiProperty({
    description: 'Allow creating withdrawals',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  [Permission.WRITE_WITHDRAWAL]?: boolean;

  @ApiProperty({
    description: 'Allow reading withdrawals',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  [Permission.READ_WITHDRAWAL]?: boolean;
}

// DTO para criar API key
export class CreateApiKeyDto extends BasePermissionsDto {
  @ApiProperty({
    description: 'Description of the API key usage',
    example: 'Production API key for payment processing',
    minLength: 3,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  description: string;
}

// DTO para atualizar API key
export class UpdateApiKeyDto extends BasePermissionsDto {
  @ApiProperty({
    description: 'Description of the API key usage',
    required: false,
    minLength: 3,
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(255)
  description?: string;
}

// DTO para validar API key
export class ValidateApiKeyDto {
  @ApiProperty({
    description: 'Public API key',
    example: 'pk_test_...',
  })
  @IsString()
  @IsNotEmpty()
  public_key: string;

  @ApiProperty({
    description: 'Secret API key',
    example: 'sk_test_...',
  })
  @IsString()
  @IsNotEmpty()
  secret_key: string;
}
