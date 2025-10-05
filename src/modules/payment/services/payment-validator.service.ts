import { BadRequestException, Injectable } from '@nestjs/common';
import {
  payment_method,
  payment_status,
  provider,
  transaction_currency,
} from '@prisma/client';
import { DocumentValidator } from 'src/common/utils/document.util';
import { PAYMENT_CONSTANTS } from '../constants/payment.constants';
import { ItemDto, SplitDto } from '../dto/payment.dto';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class PaymentValidatorService {
  validateSplit(split: SplitDto, amountNet: number, companyId: string): void {
    if (split.type === 'FIXED') {
      for (const rule of split.rules) {
        if (rule.value <= 0) {
          throw new Error('Invalid fixed split value');
        }

        if (rule.value > amountNet) {
          throw new Error('Fixed split value exceeds net amount');
        }

        if (rule.company_id === companyId) {
          throw new Error('Cannot split to the same company');
        }

        if (!rule.company_id || typeof rule.company_id !== 'string') {
          throw new Error('Invalid company ID in split rule');
        }
      }
    }

    if (split.type === 'PERCENTAGE') {
      let totalPercentage = 0;
      for (const rule of split.rules) {
        if (rule.value <= 0 || rule.value > 100) {
          throw new Error('Invalid percentage split value');
        }
        totalPercentage += rule.value;

        if (rule.company_id === companyId) {
          throw new Error('Cannot split to the same company');
        }

        if (!rule.company_id || typeof rule.company_id !== 'string') {
          throw new Error('Invalid company ID in split rule');
        }
      }
      if (totalPercentage !== 100) {
        throw new Error('Total percentage split must be 100');
      }
    }
  }

  validateMethod(paymentMethod: string): payment_method {
    const upperMethod = paymentMethod.toUpperCase();
    if (upperMethod in payment_method) {
      return payment_method[upperMethod as keyof typeof payment_method];
    }
    throw new Error('Invalid payment method');
  }

  validateDocument(documentBody: string): void {
    const type = DocumentValidator.isValid(documentBody);
    if (!type) {
      throw new Error('Invalid document');
    }
  }

  validateCurrency(currency: string): boolean {
    const validCurrencies = Object.values(transaction_currency);
    return (validCurrencies as string[]).includes(currency);
  }

  validatePaymentItems(amount: number, items: ItemDto[]): void {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Invalid payment items');
    }

    const totalAmountItems = items.reduce(
      (total, item) => total + item.unit_amount * item.quantity,
      0,
    );

    if (totalAmountItems !== amount) {
      throw new Error(
        'Total amount of items does not match the payment amount',
      );
    }

    items.forEach((item) => {
      if (
        !item.name ||
        typeof item.name !== 'string' ||
        item.name.length > 255
      ) {
        throw new Error('Invalid item name');
      }

      if (
        !item.quantity ||
        typeof item.quantity !== 'number' ||
        item.quantity <= 0
      ) {
        throw new Error('Invalid item quantity');
      }

      if (
        !item.unit_amount ||
        typeof item.unit_amount !== 'number' ||
        item.unit_amount <= 0
      ) {
        throw new Error('Invalid item unit amount');
      }

      if (item.sku && (typeof item.sku !== 'string' || item.sku.length > 100)) {
        throw new Error('Invalid item SKU');
      }
    });
  }

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

  validateCreditCardPayment(creditCard: any, amount: number): void {
    if (!creditCard) {
      throw new Error('Credit card information is required');
    }

    if (amount < PAYMENT_CONSTANTS.MIN_AMOUNT_CREDIT_CARD) {
      throw new Error('Amount below minimum for credit card payments');
    }

    if (
      creditCard.installments < PAYMENT_CONSTANTS.MIN_INSTALLMENTS ||
      creditCard.installments > PAYMENT_CONSTANTS.MAX_INSTALLMENTS
    ) {
      throw new Error('Invalid number of installments');
    }
  }

  validatePixAndBilletPayment(creditCard: any): void {
    if (creditCard) {
      throw new Error(
        'Credit card information should not be provided for PIX payments',
      );
    }
  }

  validateProviderResponse(response: any, paymentMethod: payment_method): void {
    if (
      !response.status ||
      (paymentMethod === 'PIX' && response.status === payment_status.REFUSED)
    ) {
      throw new Error('Invalid provider response');
    }
  }

  validatePaymentType(provider: provider) {
    if (provider.mode !== 'CASHIN' && provider.mode !== 'CASHIN_CASHOUT') {
      throw new Error('Provider does not support cash-in payments');
    }

    if (provider.type !== 'FIAT' && provider.type !== 'FIAT_CRIPTO') {
      throw new Error('Provider does not support fiat payments');
    }
  }

  validatePaymentReserveDays = (
    amountReserve: number,
    availableReserveDays: number,
  ) => {
    if (amountReserve === 0) {
      return; // No need to validate if there's no reserve amount
    }

    if (availableReserveDays === 0) {
      throw new BadRequestException(
        'available_days_reserve must be at least 1 when amount_reserve is set',
      );
    }
  };
}
