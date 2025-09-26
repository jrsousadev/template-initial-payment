// dto/company.dto.ts
import { transaction_currency } from '@prisma/client';
import {
  IsEmail,
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  Matches,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  Max,
  Min,
  IsArray,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({
    description: 'Company name',
    example: 'Tech Solutions LTDA',
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description: 'Company email address',
    example: 'contact@techsolutions.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Company CNPJ (14 digits)',
    example: '12345678000195',
    pattern: '^[0-9]{14}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{14}$/, {
    message: 'Document must be 14 digits (CNPJ)',
  })
  document: string;

  @ApiPropertyOptional({
    description: 'Street address',
    example: 'Rua das Flores, 123',
  })
  @IsString()
  @IsOptional()
  address_street?: string;

  @ApiPropertyOptional({
    description: 'Street number',
    example: '123',
  })
  @IsString()
  @IsOptional()
  address_street_number?: string;

  @ApiPropertyOptional({
    description: 'ZIP code (8 digits)',
    example: '01234567',
    pattern: '^[0-9]{8}$',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{8}$/, {
    message: 'CEP must be 8 digits',
  })
  address_cep?: string;

  @ApiPropertyOptional({
    description: 'City name',
    example: 'São Paulo',
  })
  @IsString()
  @IsOptional()
  address_city?: string;

  @ApiPropertyOptional({
    description: 'State abbreviation',
    example: 'SP',
    minLength: 2,
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  address_state?: string;

  @ApiPropertyOptional({
    description: 'Neighborhood',
    example: 'Centro',
  })
  @IsString()
  @IsOptional()
  address_neighborhood?: string;

  @ApiPropertyOptional({
    description: 'Soft descriptor for payments',
    example: 'TECHSOL',
    minLength: 3,
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  soft_descriptor?: string;
}

export class UploadCompanyDocumentsDto {
  @IsString()
  @IsNotEmpty()
  mother_name_responsible: string;

  @IsString()
  @IsNotEmpty()
  phone_responsible: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{11}$/, {
    message: 'Document responsible must be 11 digits (CPF)',
  })
  document_responsible: string;

  @IsString()
  @IsNotEmpty()
  name_responsible: string;

  @IsString()
  @IsNotEmpty()
  cnae_company: string;

  @IsString()
  @IsNotEmpty()
  phone_company: string;

  @IsString()
  @IsOptional()
  website_company?: string;

  @IsDateString()
  @IsNotEmpty()
  created_company_date: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  average_ticket?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthly_revenue?: number;
}

export class UpdateCompanyConfigDto {
  @IsBoolean()
  @IsOptional()
  automatic_anticipation_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  automatic_withdrawal_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  withdrawal_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  payment_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  payment_link_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  payment_credit_card_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  payment_pix_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  payment_billet_enabled?: boolean;
}

export class UpdateCompanyTaxConfigDto {
  @IsEnum(transaction_currency)
  currency: transaction_currency;

  // ========== TAXAS CASH-IN ==========
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_pix?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_billet?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_pix?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_credit_card?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_billet?: number;

  // ========== REEMBOLSO ==========
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_refund_pix?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_refund_credit_card?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_refund_billet?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_refund_pix?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_refund_credit_card?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_refund_billet?: number;

  // ========== MED/DISPUTA PIX ==========
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_dispute_pix?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_dispute_pix?: number;

  // ========== CHARGEBACK ==========
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_chargeback_credit_card?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_chargeback_credit_card?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_dispute_credit_card?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_dispute_credit_card?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_pre_chargeback_credit_card?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_pre_chargeback_credit_card?: number;

  // ========== ANTECIPAÇÃO ==========
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_anticipation?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_anticipation?: number;

  // ========== RESERVA ==========
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_reserve_credit_card?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_reserve_billet?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_reserve_pix?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_reserve_credit_card?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_reserve_billet?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_reserve_pix?: number;

  // ========== PARCELAS ==========
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  tax_rate_installments_credit_card?: number[];

  // ========== DIAS DISPONÍVEIS ==========
  @IsNumber()
  @Min(0)
  @IsOptional()
  available_days_pix?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  available_days_billet?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  available_days_anticipation?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  available_days_reserve_pix?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  available_days_reserve_credit_card?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  available_days_reserve_billet?: number;

  // ========== LIMITES MIN/MAX VENDAS ==========
  @IsNumber()
  @Min(0)
  @IsOptional()
  min_amount_sale_pix?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  min_amount_sale_credit_card?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  min_amount_sale_billet?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  max_amount_sale_pix?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  max_amount_sale_credit_card?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  max_amount_sale_billet?: number;

  // ========== CONFIG WITHDRAWAL ==========
  @IsNumber()
  @Min(0)
  @IsOptional()
  max_withdrawal?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  min_withdrawal?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  max_withdrawal_night?: number;

  // ========== TAX WITHDRAWAL ==========
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_withdrawal?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_withdrawal?: number;
}
