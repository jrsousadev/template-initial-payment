// dto/provider.dto.ts
import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  IsObject,
  IsArray,
  IsNumber,
  Max,
  Min,
} from 'class-validator';
import {
  provider_name,
  provider_model,
  provider_environment,
  provider_mode,
  provider_type,
} from '@prisma/client';
import { PartialType } from '@nestjs/swagger';

export class CreateProviderDto {
  @IsEnum(provider_name)
  name: provider_name;

  @IsEnum(provider_model)
  model: provider_model;

  @IsEnum(provider_environment)
  environment: provider_environment;

  @IsEnum(provider_mode)
  mode: provider_mode;

  @IsEnum(provider_type)
  type: provider_type;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  config?: any;

  @IsString()
  @IsOptional()
  secret_key_cashin?: string;

  @IsString()
  @IsOptional()
  public_key_cashin?: string;

  @IsString()
  @IsOptional()
  secret_key_cashout?: string;

  @IsString()
  @IsOptional()
  public_key_cashout?: string;

  @IsString()
  @IsOptional()
  receiver_id?: string;

  @IsString()
  @IsOptional()
  base_url?: string;

  @IsString()
  @IsOptional()
  pix_key?: string;

  @IsBoolean()
  @IsOptional()
  pix_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  billet_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  credit_card_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  create_default_tax_config?: boolean;
}

export class UpdateProviderDto extends PartialType(CreateProviderDto) {
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpdateProviderTaxConfigDto {
  // ========== CASH-IN ==========
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_pix?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_pix?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_billet?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_billet?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_credit_card?: number;

  // ========== MED PIX ==========
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_dispute_pix?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_dispute_pix?: number;

  // ========== REFUNDS ==========
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_refund_pix?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_refund_pix?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_refund_billet?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_refund_billet?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_refund_credit_card?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_refund_credit_card?: number;

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

  // ========== WITHDRAWAL ==========
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  tax_rate_withdrawal?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_fee_withdrawal?: number;

  // ========== CC INSTALLMENTS ==========
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  tax_rate_installments_credit_card?: number[];
}

// Alias para criar (usa o mesmo DTO)
export class CreateProviderTaxConfigDto extends UpdateProviderTaxConfigDto {}

export class CreateSubAccountDto {
  @IsString()
  @IsOptional()
  receiver_id?: string;

  @IsString()
  @IsOptional()
  public_key?: string;

  @IsString()
  @IsOptional()
  secret_key?: string;

  @IsString()
  @IsOptional()
  account_id?: string;
}

export class AssignProviderToCompanyDto {
  @IsString()
  provider_id: string;

  @IsBoolean()
  @IsOptional()
  cashin_pix?: boolean;

  @IsBoolean()
  @IsOptional()
  cashin_credit_card?: boolean;

  @IsBoolean()
  @IsOptional()
  cashin_billet?: boolean;

  @IsBoolean()
  @IsOptional()
  cashout?: boolean;
}
