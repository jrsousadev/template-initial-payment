import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  iat: number;
  exp: number;
  type?: 'access' | 'refresh';
}

export class LoginDto {
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'Password123!',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    description: 'Optional company ID to select on login',
    example: 'uuid-company-id',
  })
  @IsOptional()
  @IsUUID()
  company_id?: string;
}

export class RegisterDto {
  @ApiProperty({
    description: 'User email',
    example: 'newuser@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain uppercase, lowercase, and number or special character',
  })
  password: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({
    description: 'User document (CPF)',
    example: '12345678901',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{11}$/, {
    message: 'Document must be 11 digits (CPF)',
  })
  document?: string;
}

export class VerifyTokenDto {
  @ApiProperty({
    description: 'JWT token to verify',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  token: string;
}

export class VerifyTokenResponseDto {
  @ApiProperty({
    description: 'Whether the token is valid',
    example: true,
  })
  valid: boolean;

  @ApiPropertyOptional({
    description: 'Token payload if valid',
    type: 'object',
    properties: {
      sub: { type: 'string', example: 'uuid-user-id' },
      email: { type: 'string', example: 'user@example.com' },
      type: { type: 'string', example: 'access' },
      iat: { type: 'number', example: 1640995200 },
      exp: { type: 'number', example: 1640998800 },
    },
  })
  payload?: any;
}

export class SelectCompanyDto {
  @ApiProperty({
    description: 'Company ID to select',
    example: 'uuid-company-id',
  })
  @IsString()
  @IsUUID()
  company_id: string;
}

export class SelectCompanyResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Company selected successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Selected company details',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'uuid-company-id' },
      name: { type: 'string', example: 'Company Name' },
      type: { type: 'string', enum: ['OWNED', 'GUEST'], example: 'OWNED' },
      permissions: {
        type: 'object',
        properties: {
          read_payment: { type: 'boolean', example: true },
          write_payment: { type: 'boolean', example: true },
          read_withdrawal: { type: 'boolean', example: true },
          write_withdrawal: { type: 'boolean', example: false },
        },
      },
    },
  })
  company: any;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;
}

export class UserRegistrationResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'uuid-user-id',
  })
  id: string;

  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User status',
    example: 'PENDING_VERIFICATION',
  })
  status: string;

  @ApiProperty({
    description: 'User type',
    example: 'INDIVIDUAL',
  })
  type_user: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-01-01T00:00:00.000Z',
  })
  created_at: Date;
}

export class DocumentUploadResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Documents uploaded successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Document information',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'uuid-document-id' },
      document_front_url: {
        type: 'string',
        example: 'https://s3.amazonaws.com/bucket/front.jpg',
      },
      document_back_url: {
        type: 'string',
        example: 'https://s3.amazonaws.com/bucket/back.jpg',
      },
      document_selfie_url: {
        type: 'string',
        example: 'https://s3.amazonaws.com/bucket/selfie.jpg',
      },
      created_at: { type: 'string', example: '2023-01-01T00:00:00.000Z' },
    },
  })
  document: {
    id: string;
    document_front_url: string;
    document_back_url: string;
    document_selfie_url: string;
    created_at: Date;
  };

  @ApiProperty({
    description: 'Updated user status',
    example: 'ACTIVE',
  })
  user_status: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  refresh_token: string;
}

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Optional refresh token to invalidate',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPassword123!',
  })
  @IsString()
  current_password: string;

  @ApiProperty({
    description: 'New password',
    example: 'NewPassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain uppercase, lowercase, and number or special character',
  })
  new_password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'User email for password reset',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token',
    example: 'reset-token-from-email',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password',
    example: 'NewPassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain uppercase, lowercase, and number or special character',
  })
  new_password: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refresh_token: string;

  @ApiProperty({
    description: 'User information',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'uuid-user-id' },
      email: { type: 'string', example: 'user@example.com' },
      name: { type: 'string', example: 'John Doe' },
      companies: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid-company-id' },
            name: { type: 'string', example: 'Company Name' },
            type: {
              type: 'string',
              enum: ['OWNED', 'GUEST'],
              example: 'OWNED',
            },
          },
        },
      },
    },
  })
  user: {
    id: string;
    email: string;
    name: string;
    companies: Array<{
      id: string;
      name: string;
      type: string;
    }>;
  };

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 3600,
  })
  expires_in: number;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    companies: Array<{
      id: string;
      name: string;
      type: string;
    }>;
  };
  expires_in: number;
}

export class AuthenticatedUserDto {
  @ApiProperty({
    description: 'User ID',
    example: 'uuid-user-id',
  })
  id: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'User document',
    example: '12345678901',
  })
  document?: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  avatar_url?: string;

  @ApiPropertyOptional({
    description: 'User companies',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-company-id' },
        name: { type: 'string', example: 'Company Name' },
        document: { type: 'string', example: '12345678000195' },
        status: { type: 'string', example: 'ACTIVE' },
        type: { type: 'string', enum: ['OWNED', 'GUEST'], example: 'OWNED' },
        permissions: {
          type: 'object',
          properties: {
            read_payment: { type: 'boolean', example: true },
            write_payment: { type: 'boolean', example: true },
            read_withdrawal: { type: 'boolean', example: true },
            write_withdrawal: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  companies?: Array<{
    id: string;
    name: string;
    document: string;
    status: string;
    type: 'OWNED' | 'GUEST';
    permissions: {
      read_payment: boolean;
      write_payment: boolean;
      read_withdrawal: boolean;
      write_withdrawal: boolean;
    };
  }>;

  @ApiPropertyOptional({
    description: 'Selected company ID',
    example: 'uuid-company-id',
  })
  selected_company_id?: string;

  @ApiPropertyOptional({
    description: 'Selected company details',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'uuid-company-id' },
      name: { type: 'string', example: 'Company Name' },
      document: { type: 'string', example: '12345678000195' },
      status: { type: 'string', example: 'ACTIVE' },
      type: { type: 'string', enum: ['OWNED', 'GUEST'], example: 'OWNED' },
    },
  })
  selected_company?: {
    id: string;
    name: string;
    document: string;
    status: string;
    type: 'OWNED' | 'GUEST';
  };
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  document?: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
  companies?: Array<{
    id: string;
    name: string;
    document: string;
    status: string;
    type: 'OWNED' | 'GUEST';
    permissions: {
      read_payment: boolean;
      write_payment: boolean;
      read_withdrawal: boolean;
      write_withdrawal: boolean;
    };
  }>;
  selected_company_id?: string;
  selected_company?: {
    id: string;
    name: string;
    document: string;
    status: string;
    type: 'OWNED' | 'GUEST';
  };
}
