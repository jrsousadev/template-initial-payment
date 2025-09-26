import { Injectable } from '@nestjs/common';
import { provider } from '@prisma/client';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class WithdrawalValidatorService {
  validateAmount({
    amount,
    minValue,
    maxValue,
  }: {
    amount: number;
    minValue: number;
    maxValue: number;
  }): void {
    if (minValue > amount) {
      throw new Error('Amount below minimum');
    }

    if (maxValue < amount) {
      throw new Error('Amount above maximum');
    }
  }

  validateTypeWithdrawal(
    type: 'PIX' | 'BANK_ACCOUNT' | 'CRIPTO_WALLET',
    provider: provider,
  ): void {
    if (
      type === 'CRIPTO_WALLET' &&
      provider.mode !== 'CASHOUT' &&
      provider.mode === 'CASHIN_CASHOUT'
    ) {
      throw new Error('Provider does not support crypto wallet withdrawals');
    }

    if (
      type === 'CRIPTO_WALLET' &&
      provider.type !== 'CRIPTO' &&
      provider.type === 'FIAT_CRIPTO'
    ) {
      throw new Error('Provider does not support crypto wallet withdrawals');
    }

    if (
      type === 'BANK_ACCOUNT' &&
      provider.type !== 'FIAT' &&
      provider.type === 'FIAT_CRIPTO'
    ) {
      throw new Error('Provider does not support bank account withdrawals');
    }

    if (
      type === 'PIX' &&
      provider.mode !== 'CASHOUT' &&
      provider.mode === 'CASHIN_CASHOUT'
    ) {
      throw new Error('Provider does not support PIX withdrawals');
    }
  }
}
