import {
  $Enums,
  company,
  company_config,
  company_tax_config,
  payment_item,
  provider,
  provider_name,
  provider_tax_config,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemDto } from '../dto/payment.dto';

export interface TaxRates {
  taxCompany: number;
  taxReserveCompany: number;

  feeCompany: number;
  feeReserveCompany: number;

  taxProvider: number;
  feeProvider: number;
}

export interface PaymentFees {
  amountCompany: number;
  amountProvider: number;
  amountOrganization: number;
  amountReserve: number;
  totalFees: number;
}

export interface CreatePaymentData {
  // Campos opcionais que podem ser null
  external_id?: string | null;
  customer_id: string;
  provider_payment_id: string;
  end_to_end_id?: string | null;
  currency: $Enums.transaction_currency;
  description?: string | null;
  amount: number;
  status: $Enums.payment_status;
  amount_provider: number;
  amount_reserve: number;
  amount_net: number;
  amount_fee: number;
  amount_organization: number;
  customer_name: string;
  customer_document: string | null;
  customer_email: string;
  customer_phone: string;
  provider_name: provider_name;
  method: $Enums.payment_method;

  address_zipcode?: string;
  address_city?: string;
  address_state?: string;
  address_complement?: string;
  address_street?: string;
  address_district?: string;
  address_number?: string;
  address_country?: string;

  // Campos específicos de método de pagamento
  pix_code?: string | null;
  billet_url?: string | null;
  billet_barcode?: string | null;
  brand_credit_card?: $Enums.payment_credit_card_brand | null;
  last_four_digits_credit_card?: string | null;
  bin_credit_card?: string | null;
  auth_code_credit_card?: string | null;

  // Campos do responsável
  responsible_external_id?: string | null;
  responsible_external_document?: string | null;

  // Arrays e outros campos opcionais
  ips?: string[];
  tax_rate?: number;
  tax_fee?: number;
  tax_rate_reserve?: number;
  tax_fee_reserve?: number;
  tax_rate_anticipation?: number;
  tax_fee_anticipation?: number;
  tax_rate_provider?: number;
  tax_fee_provider?: number;

  payment_items?: payment_item[];

  // URLs
  referer_url?: string | null;
  checkout_url?: string | null;

  // Parcelamento
  installments?: number | null;
  amount_per_installments?: number | null;

  // Datas e logs
  expired_at?: Date | null;
  create_provider_log?: any;
  approve_provider_log?: any;

  company_id: string;
  company_api_key_id: string;
  provider_id: string;
}

export interface UpdatePaymentData extends Partial<CreatePaymentData> {
  status?: $Enums.payment_status;
  approve_provider_log?: any;
  refunded_provider_log?: any;
  error_message?: string | null;
}

export interface CompanyApiKey extends company {
  company_tax_configs: company_tax_config[];
  company_config: company_config;
  provider_cashin_pix: provider & {
    provider_tax_config: provider_tax_config;
  };
  provider_cashin_credit_card: provider & {
    provider_tax_config: provider_tax_config;
  };
  provider_cashin_billet: provider & {
    provider_tax_config: provider_tax_config;
  };
  provider_cashout: provider & {
    provider_tax_config: provider_tax_config;
  };
}

export interface IPaymentResponse {
  id: string;
  external_id: string | null;
  end_to_end_id: string | null;
  amount: number;
  status: $Enums.payment_status;
  method: $Enums.payment_method;
  currency: $Enums.transaction_currency;
  description: string | null;
  type: $Enums.payment_type;
  customer: {
    name: string;
    document: {
      number: string;
    };
    email: string;
    phone: string;
  };
  items: ItemDto[];
  address:
    | {
        zipcode: string | null;
        city: string | null;
        state: string | null;
        complement: string | null;
        street: string | null;
        district: string | null;
        number: string | null;
        country: string | null;
      }
    | undefined;
  pix: {
    code: string | null;
    expired_at: Date | null;
  };
  billet: {
    url: string | null;
    barcode: string | null;
  };
  credit_card: {
    brand: string | null;
    last_four_digits: string | null;
    bin: string | null;
    auth_code: string | null;
    installments: number | null;
  };
  metadata: {
    referer_url: string | null;
    checkout_url: string | null;
  };
  dates: {
    approved_at: Date | null;
    refunded_at: Date | null;
    refused_at: Date | null;
    chargedback_at: Date | null;
    refunded_processing_at: Date | null;
    disputed_at: Date | null;
    expired_at: Date | null;
    failed_at: Date | null;
    available_anticipation_at: Date | null;
    anticipated_at: Date | null;
  };
  created_at: Date;
}

// Swagger Response DTOs
export class PaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: 'pay_cm3x7n8f70000vs6g5jkg5hkn',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'External payment ID',
    example: 'ext_12345',
  })
  external_id: string | null;

  @ApiPropertyOptional({
    description: 'End-to-end ID',
    example: 'E12345678202412345678901234567890',
  })
  end_to_end_id: string | null;

  @ApiProperty({ description: 'Payment amount in cents', example: 10000 })
  amount: number;

  @ApiProperty({ description: 'Payment status', enum: $Enums.payment_status })
  status: $Enums.payment_status;

  @ApiProperty({ description: 'Payment method', enum: $Enums.payment_method })
  method: $Enums.payment_method;

  @ApiProperty({ description: 'Currency', enum: $Enums.transaction_currency })
  currency: $Enums.transaction_currency;

  @ApiPropertyOptional({
    description: 'Payment description',
    example: 'Product purchase',
  })
  description: string | null;

  @ApiProperty({ description: 'Payment type', enum: $Enums.payment_type })
  type: $Enums.payment_type;

  @ApiProperty({ description: 'Customer information' })
  customer: {
    name: string;
    document: {
      number: string;
    };
    email: string;
    phone: string;
  };

  @ApiProperty({ description: 'Payment items', type: [ItemDto] })
  items: ItemDto[];

  @ApiPropertyOptional({ description: 'Customer address' })
  address?: {
    zipcode: string | null;
    city: string | null;
    state: string | null;
    complement: string | null;
    street: string | null;
    district: string | null;
    number: string | null;
    country: string | null;
  };

  @ApiProperty({ description: 'PIX payment details' })
  pix: {
    code: string | null;
    expired_at: Date | null;
  };

  @ApiProperty({ description: 'Billet payment details' })
  billet: {
    url: string | null;
    barcode: string | null;
  };

  @ApiProperty({ description: 'Credit card payment details' })
  credit_card: {
    brand: string | null;
    last_four_digits: string | null;
    bin: string | null;
    auth_code: string | null;
    installments: number | null;
  };

  @ApiProperty({ description: 'Payment metadata' })
  metadata: {
    referer_url: string | null;
    checkout_url: string | null;
  };

  @ApiProperty({ description: 'Payment dates' })
  dates: {
    approved_at: Date | null;
    refunded_at: Date | null;
    refused_at: Date | null;
    chargedback_at: Date | null;
    refunded_processing_at: Date | null;
    disputed_at: Date | null;
    expired_at: Date | null;
    failed_at: Date | null;
    available_anticipation_at: Date | null;
    anticipated_at: Date | null;
  };

  @ApiProperty({
    description: 'Creation date',
    example: '2024-12-23T10:00:00Z',
  })
  created_at: Date;
}

export class PaymentListResponseDto {
  @ApiProperty({ description: 'List of payments', type: [PaymentResponseDto] })
  data: PaymentResponseDto[];

  @ApiProperty({ description: 'Total number of payments', example: 150 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Total number of pages', example: 8 })
  totalPages: number;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;
}
