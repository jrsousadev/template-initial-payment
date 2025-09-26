import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { $Enums, status_anticipation } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAnticipationDto {
  @ApiProperty({
    enum: ['INSTALLMENT', 'PENDING_TO_AVAILABLE'],
    example: 'INSTALLMENT',
    description: 'Type of schedule to simulate',
  })
  @IsEnum(['INSTALLMENT', 'PENDING_TO_AVAILABLE'])
  scheduleType: 'INSTALLMENT' | 'PENDING_TO_AVAILABLE';

  @ApiProperty({
    enum: $Enums.transaction_currency,
    example: 'BRL',
    description: 'Type of schedule to simulate',
  })
  @IsEnum($Enums.transaction_currency)
  currency: $Enums.transaction_currency;
}

export class SimulateAnticipationDto {
  @ApiProperty({
    enum: ['INSTALLMENT', 'PENDING_TO_AVAILABLE'],
    example: 'INSTALLMENT',
    description: 'Type of schedule to simulate',
  })
  @IsEnum(['INSTALLMENT', 'PENDING_TO_AVAILABLE'])
  scheduleType: 'INSTALLMENT' | 'PENDING_TO_AVAILABLE';

  @ApiProperty({
    enum: $Enums.transaction_currency,
    example: 'BRL',
    description: 'Type of schedule to simulate',
  })
  @IsEnum($Enums.transaction_currency)
  currency: $Enums.transaction_currency;
}

export class UpdateAnticipationStatusDto {
  @ApiProperty({
    enum: status_anticipation,
    example: 'APPROVED',
    description: 'New status for the anticipation',
  })
  @IsEnum(status_anticipation)
  @IsNotEmpty()
  status: status_anticipation;

  @ApiPropertyOptional({
    example: 'Approved by admin',
    description: 'Reason for status change',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ListAnticipationsQueryDto {
  @ApiPropertyOptional({
    enum: status_anticipation,
    example: 'PENDING',
    description: 'Filter by status',
  })
  @IsEnum(status_anticipation)
  @IsOptional()
  status?: status_anticipation;

  @ApiPropertyOptional({
    example: '2025-01-01',
    description: 'Filter anticipations from this date',
  })
  @IsDateString()
  @IsOptional()
  from_date?: string;

  @ApiPropertyOptional({
    example: '2025-12-31',
    description: 'Filter anticipations until this date',
  })
  @IsDateString()
  @IsOptional()
  to_date?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number',
  })
  @IsString()
  @IsOptional()
  page?: string;

  @ApiPropertyOptional({
    example: 20,
    description: 'Items per page',
  })
  @IsString()
  @IsOptional()
  limit?: string;
}
