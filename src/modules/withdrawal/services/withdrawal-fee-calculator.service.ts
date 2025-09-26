import { Injectable } from '@nestjs/common';
import { CalculateUtil } from 'src/common/utils/calculate.util';
import { TaxRatesWithdrawal } from '../interfaces/withdrawal.interfaces';

@Injectable()
export class WithdrawalFeeCalculatorService {
  calculateWithdrawalFees({
    amount,
    rates,
  }: {
    amount: number;
    rates: TaxRatesWithdrawal;
  }) {
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

    return {
      amountCompany,
      amountProvider,
      amountOrganization,
      totalFees: amount - amountCompany,
    };
  }
}
