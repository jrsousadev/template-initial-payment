import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { link_user_company_type } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class InviteUserToCompanyDto {
  @ApiProperty({
    description: 'Email of the user to invite',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Type of access',
    enum: link_user_company_type,
    default: link_user_company_type.GUEST,
  })
  @IsEnum(link_user_company_type)
  @IsOptional()
  type?: link_user_company_type = link_user_company_type.GUEST;

  @ApiPropertyOptional({
    description: 'Permission to read payments',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  read_payment?: boolean = false;

  @ApiPropertyOptional({
    description: 'Permission to write payments',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  write_payment?: boolean = false;

  @ApiPropertyOptional({
    description: 'Permission to read withdrawals',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  read_withdrawal?: boolean = false;

  @ApiPropertyOptional({
    description: 'Permission to write withdrawals',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  write_withdrawal?: boolean = false;
}

export class UpdateUserPermissionsDto {
  @ApiPropertyOptional({
    description: 'Type of access',
    enum: link_user_company_type,
  })
  @IsEnum(link_user_company_type)
  @IsOptional()
  type?: link_user_company_type;

  @ApiPropertyOptional({
    description: 'Permission to read payments',
  })
  @IsBoolean()
  @IsOptional()
  read_payment?: boolean;

  @ApiPropertyOptional({
    description: 'Permission to write payments',
  })
  @IsBoolean()
  @IsOptional()
  write_payment?: boolean;

  @ApiPropertyOptional({
    description: 'Permission to read withdrawals',
  })
  @IsBoolean()
  @IsOptional()
  read_withdrawal?: boolean;

  @ApiPropertyOptional({
    description: 'Permission to write withdrawals',
  })
  @IsBoolean()
  @IsOptional()
  write_withdrawal?: boolean;
}

export class AcceptInviteDto {
  @ApiProperty({
    description: 'Invitation token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  token: string;
}

export class ListCompanyMembersQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by member type',
    enum: link_user_company_type,
  })
  @IsOptional()
  @IsEnum(link_user_company_type)
  type?: link_user_company_type;

  @ApiPropertyOptional({
    description: 'Include banned members',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  include_banned?: boolean = false;
}

export class ResendInviteDto {
  @ApiProperty({
    description: 'User ID to resend invite',
  })
  @IsUUID()
  user_id: string;
}
