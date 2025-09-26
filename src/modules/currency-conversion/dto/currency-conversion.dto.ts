import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  currency_conversion_status,
  transaction_currency,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateCurrencyConversionDto {
  @ApiProperty({
    description: 'Original amount in cents',
    example: 10000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100)
  original_amount: number;

  @ApiProperty({
    description: 'Original currency',
    enum: transaction_currency,
    example: 'USD',
  })
  @IsEnum(transaction_currency)
  original_currency: transaction_currency;

  @ApiProperty({
    description: 'Target currency for conversion',
    enum: transaction_currency,
    example: 'BRL',
  })
  @IsEnum(transaction_currency)
  converted_currency: transaction_currency;
}

export class ListCurrencyConversionsQueryDto {
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
    description: 'Filter by status',
    enum: currency_conversion_status,
  })
  @IsOptional()
  @IsEnum(currency_conversion_status)
  status?: currency_conversion_status;

  @ApiPropertyOptional({
    description: 'Filter by original currency',
    enum: transaction_currency,
  })
  @IsOptional()
  @IsEnum(transaction_currency)
  original_currency?: transaction_currency;

  @ApiPropertyOptional({
    description: 'Filter by converted currency',
    enum: transaction_currency,
  })
  @IsOptional()
  @IsEnum(transaction_currency)
  converted_currency?: transaction_currency;

  @ApiPropertyOptional({
    description: 'Filter from date (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  to_date?: string;
}
