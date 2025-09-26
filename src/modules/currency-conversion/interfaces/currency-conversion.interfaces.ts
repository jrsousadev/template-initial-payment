import {
  currency_conversion_status,
  transaction_currency,
} from '@prisma/client';

export interface CurrencyConversionRate {
  from: transaction_currency;
  to: transaction_currency;
  rate: number;
  market_rate: number;
  provider_rate: number;
  company_rate: number;
}

export interface CurrencyConversionCalculation {
  original_amount: number;
  original_currency: transaction_currency;
  converted_amount: number;
  converted_currency: transaction_currency;

  // Taxas e custos
  amount_fee: number;
  amount_provider: number;
  amount_organization: number;

  // Taxas aplicadas
  tax_fee_company: number;
  tax_rate_company: number;
  tax_rate_provider: number;
  tax_fee_provider: number;
  tax_rate_market: number;

  // Informações adicionais
  effective_rate: number;
  total_cost: number;
}

export interface CurrencyConversionResponse {
  id: string;
  status: currency_conversion_status;
  original_amount: number;
  original_currency: transaction_currency;
  converted_amount: number;
  converted_currency: transaction_currency;
  amount_fee: number;
  amount_provider: number;
  amount_organization: number;
  tax_fee_company: number;
  tax_rate_company: number;
  tax_rate_provider: number;
  tax_fee_provider: number;
  tax_rate_market: number;
  created_at: Date;
  updated_at: Date;
  conversion_at: Date;
  company_id: string;
}

export interface CurrencyConversionFilters {
  status?: currency_conversion_status;
  original_currency?: transaction_currency;
  converted_currency?: transaction_currency;
  fromDate?: Date;
  toDate?: Date;
}

export interface PaginationOptions {
  skip: number;
  take: number;
}

export interface CurrencyConversionListResponse {
  data: CurrencyConversionResponse[];
  total: number;
  page: number;
  last_page: number;
}
