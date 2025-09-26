import {
  $Enums,
  company as PrismaCompany,
  company_config as PrismaCompanyConfig,
  company_document as PrismaCompanyDocument,
  company_tax_config as PrismaCompanyTaxConfig,
  wallet as PrismaWallet,
  provider as PrismaProvider,
  transaction_currency,
} from '@prisma/client';
import { CompanyTaxConfig } from './company-tax-config.entity';

export class Company implements PrismaCompany {
  id: string;
  status: $Enums.company_status;
  balance_blocked: number;
  name: string;
  email: string;
  document: string;
  address_street: string;
  address_street_number: string;
  address_cep: string;
  address_city: string;
  address_state: string;
  address_neighborhood: string;
  soft_descriptor: string;
  created_at: Date;
  updated_at: Date;
  banned_at: Date | null;
  provider_cashin_pix_id: string | null;
  provider_cashin_credit_card_id: string | null;
  provider_cashin_billet_id: string | null;
  provider_cashout_id: string | null;
  signature_key_webhook: string;

  company_config?: PrismaCompanyConfig;
  company_document?: PrismaCompanyDocument;
  company_tax_configs?: CompanyTaxConfig[];
  wallets?: PrismaWallet[];
  provider_cashin_pix?: PrismaProvider;
  provider_cashin_credit_card?: PrismaProvider;
  provider_cashin_billet?: PrismaProvider;
  provider_cashout?: PrismaProvider;

  constructor(
    data: PrismaCompany & {
      company_config?: PrismaCompanyConfig;
      company_document?: PrismaCompanyDocument;
      company_tax_configs?: PrismaCompanyTaxConfig[];
      wallets?: PrismaWallet[];
      provider_cashin_pix?: PrismaProvider;
      provider_cashin_credit_card?: PrismaProvider;
      provider_cashin_billet?: PrismaProvider;
      provider_cashout?: PrismaProvider;
    },
  ) {
    Object.assign(this, data);

    if (data.company_tax_configs) {
      this.company_tax_configs = data.company_tax_configs.map(
        (config) => new CompanyTaxConfig(config),
      );
    }
  }

  getTaxConfigByCurrency(currency: transaction_currency): CompanyTaxConfig {
    const taxConfig = this.company_tax_configs?.find(
      (config) => config.currency === currency,
    );
    if (!taxConfig) {
      throw new Error(`No tax configuration found for currency: ${currency}`);
    }
    return taxConfig;
  }

  getDefaultTaxConfig(): CompanyTaxConfig | undefined {
    return (
      this.getTaxConfigByCurrency('BRL' as transaction_currency) ||
      this.company_tax_configs?.[0]
    );
  }

  hasTaxConfigForCurrency(currency: transaction_currency): boolean {
    return !!this.getTaxConfigByCurrency(currency);
  }

  getAllCurrencies(): transaction_currency[] {
    return this.company_tax_configs?.map((config) => config.currency) || [];
  }

  isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  isBanned(): boolean {
    return this.status === 'BANNED' || this.banned_at !== null;
  }

  canProcessPayments(): boolean {
    return this.isActive() && this.company_config?.payment_enabled === true;
  }

  canProcessWithdrawals(): boolean {
    return this.isActive() && this.company_config?.withdrawal_enabled === true;
  }

  canProcessPaymentMethod(method: 'PIX' | 'CREDIT_CARD' | 'BILLET'): boolean {
    if (!this.canProcessPayments()) return false;

    switch (method) {
      case 'PIX':
        return this.company_config?.payment_pix_enabled === true;
      case 'CREDIT_CARD':
        return this.company_config?.payment_credit_card_enabled === true;
      case 'BILLET':
        return this.company_config?.payment_billet_enabled === true;
      default:
        return false;
    }
  }

  hasProvider(type: 'PIX' | 'CREDIT_CARD' | 'BILLET' | 'CASHOUT'): boolean {
    switch (type) {
      case 'PIX':
        return !!this.provider_cashin_pix_id;
      case 'CREDIT_CARD':
        return !!this.provider_cashin_credit_card_id;
      case 'BILLET':
        return !!this.provider_cashin_billet_id;
      case 'CASHOUT':
        return !!this.provider_cashout_id;
      default:
        return false;
    }
  }

  getFullAddress(): string {
    const parts = [
      this.address_street,
      this.address_street_number,
      this.address_neighborhood,
      this.address_city,
      this.address_state,
      this.address_cep,
    ].filter(Boolean);

    return parts.join(', ');
  }
}
