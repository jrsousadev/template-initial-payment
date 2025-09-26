import { ApiProperty } from '@nestjs/swagger';
import { transaction_currency } from '@prisma/client';

export interface ICompanyBalancesResponse {
  balances: Array<{
    currency: transaction_currency;
    total_balance: number;
    balances_by_account: {
      BALANCE_RESERVE: number;
      BALANCE_AVAILABLE: number;
      BALANCE_PENDING: number;
    };
  }>;
}

// Swagger Response DTOs
export class CompanyResponseDto {
  @ApiProperty({
    type: 'string',
    example: 'comp_1234567890',
    description: 'Company unique identifier',
  })
  id: string;

  @ApiProperty({
    type: 'string',
    example: 'Tech Solutions LTDA',
    description: 'Company name',
  })
  name: string;

  @ApiProperty({
    type: 'string',
    example: 'contact@techsolutions.com',
    description: 'Company email',
  })
  email: string;

  @ApiProperty({
    type: 'string',
    example: '12345678000195',
    description: 'Company CNPJ',
  })
  document: string;

  @ApiProperty({
    type: 'string',
    example: 'PENDING',
    description: 'Company status',
  })
  status: string;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'Creation timestamp',
  })
  created_at: string;
}

export class DocumentUploadResponseDto {
  @ApiProperty({ type: 'string', example: 'Documents uploaded successfully' })
  message: string;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'string', example: 'doc_1234567890' },
      created_at: { type: 'string', format: 'date-time' },
    },
  })
  document: {
    id: string;
    created_at: string;
  };

  @ApiProperty({ type: 'string', example: 'ACTIVE' })
  company_status: string;
}

export class TaxConfigDto {
  @ApiProperty({ type: 'string', example: 'tax_1234567890' })
  id: string;

  @ApiProperty({ type: 'string', example: 'BRL' })
  currency: string;

  @ApiProperty({ type: 'number', example: 2.5 })
  tax_rate_pix: number;

  @ApiProperty({ type: 'number', example: 3.5 })
  tax_rate_credit_card: number;

  @ApiProperty({ type: 'number', example: 1.5 })
  tax_rate_billet: number;

  @ApiProperty({ type: 'number', example: 0.5 })
  tax_fee_pix: number;

  @ApiProperty({ type: 'number', example: 0.3 })
  tax_fee_credit_card: number;

  @ApiProperty({ type: 'number', example: 2.0 })
  tax_fee_billet: number;

  @ApiProperty({ type: 'number', example: 1 })
  available_days_pix: number;

  @ApiProperty({ type: 'number', example: 30 })
  available_days_credit_card: number;

  @ApiProperty({ type: 'number', example: 1 })
  available_days_billet: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  created_at: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at: string;
}

export class TaxConfigResponseDto {
  @ApiProperty({ type: TaxConfigDto })
  tax_config: TaxConfigDto;
}

export class TaxConfigsResponseDto {
  @ApiProperty({ type: [TaxConfigDto] })
  tax_configs: TaxConfigDto[];
}

export class TaxConfigUpdateResponseDto {
  @ApiProperty({
    type: 'string',
    example: 'Tax configuration updated successfully',
  })
  message: string;

  @ApiProperty({ type: TaxConfigDto })
  tax_config: TaxConfigDto;
}

export class TaxConfigCreateResponseDto {
  @ApiProperty({
    type: 'string',
    example: 'Tax configuration created successfully',
  })
  message: string;

  @ApiProperty({ type: TaxConfigDto })
  tax_config: TaxConfigDto;
}

export class CompanyConfigDto {
  @ApiProperty({ type: 'string', example: 'config_1234567890' })
  id: string;

  @ApiProperty({ type: 'boolean', example: true })
  automatic_anticipation_enabled: boolean;

  @ApiProperty({ type: 'boolean', example: false })
  automatic_withdrawal_enabled: boolean;

  @ApiProperty({ type: 'boolean', example: true })
  withdrawal_enabled: boolean;

  @ApiProperty({ type: 'boolean', example: true })
  payment_enabled: boolean;

  @ApiProperty({ type: 'boolean', example: true })
  payment_link_enabled: boolean;

  @ApiProperty({ type: 'boolean', example: true })
  payment_credit_card_enabled: boolean;

  @ApiProperty({ type: 'boolean', example: true })
  payment_pix_enabled: boolean;

  @ApiProperty({ type: 'boolean', example: false })
  payment_billet_enabled: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  created_at: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at: string;
}

export class CompanyConfigResponseDto {
  @ApiProperty({ type: CompanyConfigDto })
  config: CompanyConfigDto;
}

export class CompanyConfigUpdateResponseDto {
  @ApiProperty({
    type: 'string',
    example: 'Company configuration updated successfully',
  })
  message: string;

  @ApiProperty({ type: CompanyConfigDto })
  config: CompanyConfigDto;
}

export class CompanyConfigCreateResponseDto {
  @ApiProperty({
    type: 'string',
    example: 'Company configuration created successfully',
  })
  message: string;

  @ApiProperty({ type: CompanyConfigDto })
  config: CompanyConfigDto;
}

export class CompanyStatusDto {
  @ApiProperty({ type: 'string', example: 'comp_1234567890' })
  id: string;

  @ApiProperty({
    type: 'string',
    enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED'],
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    type: 'string',
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    example: 'VERIFIED',
  })
  verification_status: string;

  @ApiProperty({ type: 'boolean', example: true })
  documents_uploaded: boolean;

  @ApiProperty({ type: 'boolean', example: true })
  kyc_completed: boolean;

  @ApiProperty({ type: 'boolean', example: true })
  can_process_payments: boolean;

  @ApiProperty({ type: 'boolean', example: true })
  can_withdraw: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  last_status_update: string;
}

export class CompanyStatusResponseDto {
  @ApiProperty({ type: CompanyStatusDto })
  status: CompanyStatusDto;
}

export class BalanceAccountTypesDto {
  @ApiProperty({ type: 'number', example: 15000.5 })
  AVAILABLE: number;

  @ApiProperty({ type: 'number', example: 2500.0 })
  PENDING: number;

  @ApiProperty({ type: 'number', example: 500.0 })
  RESERVED: number;
}

export class BalanceItemDto {
  @ApiProperty({ type: 'string', example: 'BRL' })
  currency: string;

  @ApiProperty({ type: 'number', example: 15000.5 })
  available: number;

  @ApiProperty({ type: 'number', example: 2500.0 })
  pending: number;

  @ApiProperty({ type: 'number', example: 500.0 })
  reserved: number;

  @ApiProperty({ type: 'number', example: 18000.5 })
  total: number;

  @ApiProperty({ type: BalanceAccountTypesDto })
  account_types: BalanceAccountTypesDto;
}

export class CompanyBalancesResponseDto {
  @ApiProperty({ type: [BalanceItemDto] })
  balances: BalanceItemDto[];
}

export class WalletDto {
  @ApiProperty({ type: 'string', example: 'wallet_1234567890' })
  id: string;

  @ApiProperty({ type: 'string', example: 'BRL' })
  currency: string;

  @ApiProperty({ type: 'string', example: 'AVAILABLE' })
  account_type: string;

  @ApiProperty({ type: 'number', example: 15000.5 })
  balance: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  created_at: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at: string;
}

export class WalletsResponseDto {
  @ApiProperty({ type: [WalletDto] })
  wallets: WalletDto[];
}
