import { Injectable } from '@nestjs/common';
import { company_tax_config, payment_method } from '@prisma/client';
import { CompanyApiKey, TaxRates } from '../interfaces/transaction.interfaces';
import { CalculateUtil } from 'src/common/utils/calculate.util';

@Injectable()
export class PaymentFeeCalculatorService {
  getTaxRates({
    method,
    creditCard,
    company,
    companyTaxConfig,
  }: {
    method: payment_method;
    creditCard?: any;
    company: CompanyApiKey;
    companyTaxConfig: company_tax_config;
  }): TaxRates {
    const provider = company[`provider_cashin_${method.toLowerCase()}`];

    if (method === 'PIX') {
      return {
        taxCompany: companyTaxConfig.tax_rate_pix,
        taxReserveCompany: companyTaxConfig.tax_rate_reserve_pix,
        feeCompany: companyTaxConfig.tax_fee_pix,
        feeReserveCompany: companyTaxConfig.tax_fee_reserve_pix,
        taxProvider: provider.provider_tax_config.tax_rate_pix,
        feeProvider: provider.provider_tax_config.tax_fee_pix,
      };
    }

    if (method === 'BILLET') {
      return {
        taxCompany: companyTaxConfig.tax_rate_billet,
        taxReserveCompany: companyTaxConfig.tax_rate_reserve_billet,
        feeCompany: companyTaxConfig.tax_fee_billet,
        feeReserveCompany: companyTaxConfig.tax_fee_reserve_billet,
        taxProvider: provider.provider_tax_config.tax_rate_billet,
        feeProvider: provider.provider_tax_config.tax_fee_billet,
      };
    }

    const installmentIdx = (creditCard?.installments || 1) - 1;

    return {
      taxCompany:
        companyTaxConfig.tax_rate_installments_credit_card[installmentIdx],
      taxProvider:
        provider.provider_tax_config.tax_rate_installments_credit_card[
          installmentIdx
        ],

      feeProvider: provider.provider_tax_config.tax_fee_credit_card,
      feeCompany: companyTaxConfig.tax_fee_credit_card,

      feeReserveCompany: companyTaxConfig.tax_fee_reserve_credit_card,
      taxReserveCompany: companyTaxConfig.tax_rate_reserve_credit_card,
    };
  }

  calculatePaymentFees({ amount, rates }: { amount: number; rates: TaxRates }) {
    const amountCompany = CalculateUtil.calculateNetAmount(
      amount,
      rates.taxCompany,
      rates.feeCompany,
    );

    const companyWithProviderTax = CalculateUtil.calculateNetAmount(
      amount,
      rates.taxProvider,
      rates.feeProvider,
    );

    const amountProvider = Math.floor(amount - companyWithProviderTax);
    const amountOrganization = Math.floor(
      amount - amountCompany - amountProvider,
    );
    const amountReserve = Math.floor(
      amount * (rates.taxReserveCompany / 100) + rates.feeReserveCompany,
    );

    return {
      amountCompany,
      amountProvider,
      amountOrganization,
      amountReserve,
      totalFees: amount - amountCompany,
    };
  }
}
