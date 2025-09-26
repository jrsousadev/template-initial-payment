// dto/create-user.dto.ts
import {
  IsEmail,
  IsString,
  IsEnum,
  MinLength,
  IsOptional,
  Matches,
  IsNotEmpty,
  IsBoolean,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type_user } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description:
      'User password (must contain uppercase, lowercase, number/special character)',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain uppercase, lowercase, number/special character',
  })
  password: string;

  @ApiProperty({
    description: 'User phone number in international format',
    example: '+5511999999999',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone must be a valid international format',
  })
  phone: string;

  @ApiProperty({
    description: 'User document (11 digits for CPF or 14 digits for CNPJ)',
    example: '12345678901',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{11,14}$/, {
    message: 'Document must be 11 digits (CPF) or 14 digits (CNPJ)',
  })
  document: string;

  @ApiPropertyOptional({
    description: 'User type',
    enum: type_user,
    example: 'INDIVIDUAL',
  })
  @IsEnum(type_user)
  @IsOptional()
  type_user: type_user;
}

// dto/upload-documents.dto.ts
export interface FileUpload {
  filename: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export class UploadDocumentsDto {
  document_front: FileUpload;
  document_back: FileUpload;
  document_selfie: FileUpload;
}

export class UpdateUserDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone must be a valid international format',
  })
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  two_fa_enabled?: boolean;
}

export class ValidateDocumentDto {
  @IsString()
  @IsNotEmpty()
  document: string;

  @IsEnum(type_user)
  type: type_user;
}

export class RequestPasswordResetDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain uppercase, lowercase, number/special character',
  })
  new_password: string;
}

export class EnableTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class VerifyTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}
