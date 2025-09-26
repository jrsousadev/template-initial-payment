import {
  company_tax_config as PrismaCompanyTaxConfig,
  transaction_currency,
} from '@prisma/client';
import { Company } from './company.entity';

export class CompanyTaxConfig implements PrismaCompanyTaxConfig {
  id: string;
  currency: transaction_currency;

  // taxas cash-in
  tax_rate_pix: number;
  tax_rate_billet: number;
  tax_fee_pix: number;
  tax_fee_credit_card: number;
  tax_fee_billet: number;

  // reembolso
  tax_rate_refund_pix: number;
  tax_rate_refund_credit_card: number;
  tax_rate_refund_billet: number;
  tax_fee_refund_pix: number;
  tax_fee_refund_credit_card: number;
  tax_fee_refund_billet: number;

  // med
  tax_rate_dispute_pix: number;
  tax_fee_dispute_pix: number;

  // chargeback
  tax_rate_chargeback_credit_card: number;
  tax_fee_chargeback_credit_card: number;
  tax_rate_dispute_credit_card: number;
  tax_fee_dispute_credit_card: number;
  tax_rate_pre_chargeback_credit_card: number;
  tax_fee_pre_chargeback_credit_card: number;

  // antecipação
  tax_rate_anticipation: number;
  tax_fee_anticipation: number;

  // reserva
  tax_rate_reserve_credit_card: number;
  tax_rate_reserve_billet: number;
  tax_rate_reserve_pix: number;
  tax_fee_reserve_credit_card: number;
  tax_fee_reserve_billet: number;
  tax_fee_reserve_pix: number;

  // parcelas
  tax_rate_installments_credit_card: number[];

  // available days
  available_days_pix: number;
  available_days_billet: number;
  available_days_anticipation: number;
  available_days_reserve_pix: number;
  available_days_reserve_credit_card: number;
  available_days_reserve_billet: number;

  // config min/max sales
  min_amount_sale_pix: number;
  min_amount_sale_credit_card: number;
  min_amount_sale_billet: number;
  max_amount_sale_pix: number;
  max_amount_sale_credit_card: number;
  max_amount_sale_billet: number;

  // config withdrawal
  max_withdrawal: number;
  min_withdrawal: number;
  max_withdrawal_night: number;

  // tax withdrawal
  tax_rate_withdrawal: number;
  tax_fee_withdrawal: number;

  company_id: string;
  company?: Company;

  constructor(data: PrismaCompanyTaxConfig) {
    Object.assign(this, data);
  }

  calculatePixFee(amount: number): number {
    return Math.round(amount * this.tax_rate_pix + this.tax_fee_pix);
  }

  calculateCreditCardFee(amount: number, installments: number = 1): number {
    const installmentRate =
      installments > 1 && installments <= 12
        ? this.tax_rate_installments_credit_card[installments - 2] || 0
        : 0;

    return Math.round(amount * installmentRate + this.tax_fee_credit_card);
  }

  calculateBilletFee(amount: number): number {
    return Math.round(amount * this.tax_rate_billet + this.tax_fee_billet);
  }

  calculateWithdrawalFee(amount: number): number {
    return Math.round(
      amount * this.tax_rate_withdrawal + this.tax_fee_withdrawal,
    );
  }

  calculateAnticipationFee(amount: number): number {
    return Math.round(
      amount * this.tax_rate_anticipation + this.tax_fee_anticipation,
    );
  }

  isAmountValidForPix(amount: number): boolean {
    const min = this.min_amount_sale_pix;
    const max = this.max_amount_sale_pix;
    return amount >= min && amount <= max;
  }

  isAmountValidForCreditCard(amount: number): boolean {
    const min = this.min_amount_sale_credit_card;
    const max = this.max_amount_sale_credit_card;
    return amount >= min && amount <= max;
  }

  isAmountValidForBillet(amount: number): boolean {
    const min = this.min_amount_sale_billet;
    const max = this.max_amount_sale_billet;
    return amount >= min && amount <= max;
  }

  isWithdrawalAmountValid(
    amount: number,
    isNightTime: boolean = false,
  ): boolean {
    const min = this.min_withdrawal;
    const max = isNightTime
      ? this.max_withdrawal_night || this.max_withdrawal
      : this.max_withdrawal;
    return amount >= min && amount <= max;
  }
}
