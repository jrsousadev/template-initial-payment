import { ApiProperty } from '@nestjs/swagger';
import {
  status_anticipation,
  transaction_currency,
  type_anticipation,
} from '@prisma/client';

export interface CreateAnticipationData {
  id?: string;
  status?: status_anticipation;
  group_payments_id: string;
  total_amount: number;
  amount_net: number;
  amount_organization: number;
  tax: number;
  fee: number;
  company_id: string;
  currency: transaction_currency;
  type: type_anticipation;
  amount_fee: number;
}

export interface AnticipationCalculation {
  schedules: Array<{
    schedule_id: string;
    payment_id: string;
    type: string;
    original_amount: number;
    discount: number;
    net_amount: number;
    days_anticipated: number;
    scheduled_date: Date;
    installment_info: string | null;
  }>;
  summary: {
    total_gross: number;
    total_discount: number;
    total_net: number;
    anticipation_rate: number;
    schedules_count: number;
  };
  payments_ids: string[];
  fees: {
    tax_fee_anticipation: number;
    tax_rate_anticipation: number;
  };
}

export interface AvailableSchedulesResponse {
  installments: {
    count: number;
    total_amount: number;
    next_release_date: Date | null;
  };
  pending_to_available: {
    count: number;
    total_amount: number;
    next_release_date: Date | null;
  };
  total: {
    count: number;
    total_amount: number;
  };
}

// Swagger Response DTOs
export class ScheduleItemDto {
  @ApiProperty({ type: 'string', example: 'schedule_123' })
  id: string;

  @ApiProperty({ type: 'number', example: 1000.5 })
  amount: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  payment_date: string;

  @ApiProperty({ type: 'string', example: 'payment_456' })
  payment_id: string;

  @ApiProperty({ type: 'number', example: 1, required: false })
  installment_number?: number;
}

export class AvailableSchedulesDto {
  @ApiProperty({
    type: [ScheduleItemDto],
    description: 'Available installment schedules',
  })
  INSTALLMENT: ScheduleItemDto[];

  @ApiProperty({
    type: [ScheduleItemDto],
    description: 'Available pending to available schedules',
  })
  PENDING_TO_AVAILABLE: ScheduleItemDto[];
}

export class AnticipationSimulationDto {
  @ApiProperty({
    type: 'number',
    example: 1000.0,
    description: 'Total amount to be anticipated',
  })
  total_amount: number;

  @ApiProperty({
    type: 'number',
    example: 950.0,
    description: 'Net amount after fees',
  })
  amount_net: number;

  @ApiProperty({
    type: 'number',
    example: 50.0,
    description: 'Organization fee amount',
  })
  amount_organization: number;

  @ApiProperty({
    type: 'number',
    example: 5.0,
    description: 'Tax percentage applied',
  })
  tax: number;

  @ApiProperty({
    type: 'number',
    example: 50.0,
    description: 'Fixed fee amount',
  })
  fee: number;

  @ApiProperty({
    type: 'string',
    example: 'BRL',
    description: 'Currency of the amounts',
  })
  currency: string;

  @ApiProperty({
    type: 'number',
    example: 3,
    description: 'Number of schedules included',
  })
  schedules_count: number;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'Estimated processing date',
  })
  estimated_date: string;
}

export class AnticipationResponseDto {
  @ApiProperty({
    type: 'string',
    example: 'ant_1234567890',
    description: 'Unique anticipation identifier',
  })
  id: string;

  @ApiProperty({
    type: 'number',
    example: 950.0,
    description: 'Net amount transferred to available balance',
  })
  amount_net: number;

  @ApiProperty({
    type: 'number',
    example: 50.0,
    description: 'Organization fee charged',
  })
  amount_organization: number;

  @ApiProperty({
    type: 'number',
    example: 1000.0,
    description: 'Total amount anticipated',
  })
  total_amount: number;

  @ApiProperty({
    type: 'number',
    example: 5.0,
    description: 'Tax percentage applied',
  })
  tax: number;

  @ApiProperty({
    type: 'number',
    example: 50.0,
    description: 'Fixed fee amount',
  })
  fee: number;

  @ApiProperty({
    type: 'string',
    example: 'BRL',
    description: 'Currency of the amounts',
  })
  currency: string;

  @ApiProperty({
    type: 'string',
    example: 'INSTALLMENT',
    description: 'Type of anticipation',
  })
  type: string;

  @ApiProperty({
    type: 'string',
    example: 'group_789',
    description: 'Payment group identifier',
  })
  group_payments_id: string;

  @ApiProperty({
    type: 'string',
    example: 'comp_456',
    description: 'Company identifier',
  })
  company_id: string;

  @ApiProperty({
    type: [String],
    example: ['pay_123', 'pay_456'],
    description: 'List of payment IDs included in anticipation',
  })
  payments_ids: string[];

  @ApiProperty({
    type: 'string',
    example: 'PENDING',
    description: 'Current anticipation status',
  })
  status: string;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'Creation timestamp',
  })
  created_at: string;
}

export class AnticipationListItemDto {
  @ApiProperty({ type: 'string', example: 'ant_1234567890' })
  id: string;

  @ApiProperty({ type: 'number', example: 950.0 })
  amount_net: number;

  @ApiProperty({ type: 'number', example: 50.0 })
  amount_organization: number;

  @ApiProperty({ type: 'number', example: 1000.0 })
  total_amount: number;

  @ApiProperty({ type: 'number', example: 5.0 })
  tax: number;

  @ApiProperty({ type: 'number', example: 50.0 })
  fee: number;

  @ApiProperty({ type: 'string', example: 'BRL' })
  currency: string;

  @ApiProperty({ type: 'string', example: 'INSTALLMENT' })
  type: string;

  @ApiProperty({ type: 'string', example: 'APPROVED' })
  status: string;

  @ApiProperty({ type: 'string', example: 'group_789' })
  group_payments_id: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  created_at: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at: string;
}

export class PaginationDto {
  @ApiProperty({ type: 'number', example: 1 })
  page: number;

  @ApiProperty({ type: 'number', example: 20 })
  limit: number;

  @ApiProperty({ type: 'number', example: 150 })
  total: number;

  @ApiProperty({ type: 'number', example: 8 })
  total_pages: number;
}

export class AnticipationListResponseDto {
  @ApiProperty({ type: [AnticipationListItemDto] })
  data: AnticipationListItemDto[];

  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}
