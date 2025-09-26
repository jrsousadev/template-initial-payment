import { withdrawal_type, withdrawal_status } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface IWithdrawalResponse {
  id: string;
  external_id: string | null;
  end_to_end_id: string | null;
  status: withdrawal_status;
  type: withdrawal_type;
  amount: number;
  total_amount: number;
  fees: {
    amount_fee: number;
    tax_rate: number;
    tax_fee: number;
  };
  receiver: {
    id: string | null;
    type: withdrawal_type;
    pix_key?: string | null;
    bank_account?: string | null;
    wallet_address?: string | null;
  };
  dates: {
    approved_at: Date | null;
    processing_at: Date | null;
    refunded_at: Date | null;
    refused_at: Date | null;
    failed_at: Date | null;
  };
  created_at: Date;
}

export interface TaxRatesWithdrawal {
  taxCompany: number;
  feeCompany: number;
  taxProvider: number;
  feeProvider: number;
}

export class WithdrawalResponseDto {
  @ApiProperty({
    description: 'Withdrawal ID',
    example: 'wth_cm3x7n8f70000vs6g5jkg5hkn',
  })
  id: string;

  @ApiProperty({
    description: 'External withdrawal ID',
    example: 'ext_withdrawal_123456',
  })
  external_id: string;

  @ApiProperty({
    description: 'End-to-end withdrawal ID',
    example: 'E12345678202412231000000001',
  })
  end_to_end: string;

  @ApiProperty({
    description: 'Withdrawal amount in cents',
    example: 10000,
  })
  amount: number;

  @ApiProperty({
    description: 'Withdrawal status',
    example: 'PENDING',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  })
  status: string;

  @ApiProperty({
    description: 'Withdrawal description',
    example: 'Payment for services',
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Receiver information',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'rcv_cm3x7n8f70000vs6g5jkg5hkn' },
      name: { type: 'string', example: 'John Doe' },
      document: { type: 'string', example: '12345678901' },
    },
  })
  receiver?: {
    id: string;
    name: string;
    document: string;
  };

  @ApiProperty({
    description: 'Withdrawal creation date',
    example: '2024-12-23T10:00:00Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'Withdrawal last update date',
    example: '2024-12-23T10:00:00Z',
  })
  updated_at: string;
}

export class WithdrawalListResponseDto {
  @ApiProperty({
    description: 'List of withdrawals',
    type: [WithdrawalResponseDto],
  })
  data: WithdrawalResponseDto[];

  @ApiProperty({
    description: 'Total number of withdrawals',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Current page',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
  })
  limit: number;
}

export class WithdrawalDetailsDto extends WithdrawalResponseDto {
  @ApiPropertyOptional({
    description: 'Transaction fees',
    type: 'object',
    properties: {
      platform_fee: { type: 'number', example: 100 },
      gateway_fee: { type: 'number', example: 50 },
      total_fee: { type: 'number', example: 150 },
    },
  })
  fees?: {
    platform_fee: number;
    gateway_fee: number;
    total_fee: number;
  };

  @ApiPropertyOptional({
    description: 'Request metadata',
    type: 'object',
    properties: {
      ip_address: { type: 'string', example: '192.168.1.1' },
      user_agent: { type: 'string', example: 'Mozilla/5.0...' },
      referer: { type: 'string', example: 'https://example.com' },
    },
  })
  metadata?: {
    ip_address: string;
    user_agent: string;
    referer: string;
  };
}

export class WithdrawalCreatedResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Withdrawal created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created withdrawal information',
    type: WithdrawalResponseDto,
  })
  withdrawal: WithdrawalResponseDto;
}
