import {
  receiver_status,
  receiver_type,
  receiver_bank_account_type,
  receiver_bank_holder_type,
  receiver_pix_type,
  receiver_crypto_network,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface CreateReceiverData {
  type: receiver_type;
  status?: receiver_status;

  // Bank fields
  bank_holder_name?: string;
  bank_holder_type?: receiver_bank_holder_type;
  bank_holder_document?: string;
  bank_code?: string;
  bank_name?: string;
  bank_branch_code?: string;
  bank_branch_check_digit?: string;
  bank_account_number?: string;
  bank_account_check_digit?: string;
  bank_account_type?: receiver_bank_account_type;

  // PIX fields
  pix_key?: string;
  pix_type?: receiver_pix_type;

  // Wallet fields
  wallet_network?: receiver_crypto_network;
  wallet_id?: string;

  company_id: string;
}

export interface UpdateReceiverData extends Partial<CreateReceiverData> {
  status?: receiver_status;
}

export interface ReceiverResponse {
  id: string;
  status: receiver_status;
  type: receiver_type;

  bank?: {
    holder_name: string | null;
    holder_type: receiver_bank_holder_type | null;
    holder_document: string | null;
    code: string | null;
    name: string | null;
    branch_code: string | null;
    branch_check_digit: string | null;
    account_number: string | null;
    account_check_digit: string | null;
    account_type: receiver_bank_account_type | null;
  };

  pix?: {
    key: string | null;
    type: receiver_pix_type | null;
  };

  wallet?: {
    network: receiver_crypto_network | null;
    address: string | null;
  };

  created_at: Date;
  updated_at: Date;
}

export class ReceiverResponseDto {
  @ApiProperty({
    description: 'Receiver ID',
    example: 'rcv_cm3x7n8f70000vs6g5jkg5hkn',
  })
  id: string;

  @ApiProperty({
    description: 'Receiver name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'Receiver document',
    example: '12345678901',
  })
  document: string;

  @ApiProperty({
    description: 'Receiver email',
    example: 'john@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Receiver status',
    enum: ['ACTIVE', 'PENDING', 'REJECTED'],
  })
  status: receiver_status;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-12-23T10:00:00Z',
  })
  created_at: Date;
}

export class ReceiverDetailsDto extends ReceiverResponseDto {
  @ApiPropertyOptional({
    description: 'Receiver phone',
    example: '+5511999999999',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Bank account information',
    type: 'object',
    properties: {
      bank_code: { type: 'string', example: '001' },
      agency: { type: 'string', example: '1234' },
      account: { type: 'string', example: '12345-6' },
      account_type: { type: 'string', example: 'CHECKING' },
    },
  })
  bank_account?: {
    bank_code: string;
    agency: string;
    account: string;
    account_type: string;
  };

  @ApiProperty({
    description: 'Last update date',
    example: '2024-12-23T10:00:00Z',
  })
  updated_at: Date;
}

export class ReceiverListResponseDto {
  @ApiProperty({
    description: 'List of receivers',
    type: [ReceiverResponseDto],
  })
  data: ReceiverResponseDto[];

  @ApiProperty({
    description: 'Total number of receivers',
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
}

export class ReceiverStatusUpdateResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Receiver status updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated receiver information',
    type: 'object',
    properties: {
      id: { type: 'string' },
      status: { type: 'string', enum: ['ACTIVE', 'PENDING', 'REJECTED'] },
      updated_at: { type: 'string', format: 'date-time' },
    },
  })
  receiver: {
    id: string;
    status: receiver_status;
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
