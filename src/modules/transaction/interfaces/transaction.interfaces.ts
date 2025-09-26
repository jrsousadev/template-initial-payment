import {
  payment_method,
  payment_status,
  provider_name,
  transaction_account_type,
  transaction_currency,
  transaction_movement_type,
  transaction_operation_type,
} from '@prisma/client';

export interface CreateTransactionData {
  accountType: transaction_account_type;
  movementType: transaction_movement_type;
  operationType: transaction_operation_type;
  currency: transaction_currency;
  description: string;
  amount: number;
  amountFee: number;
  amountNet: number;
  sourceId: string;
  webhookStatus: payment_status;
  isVisible?: boolean;
  companyId: string;
  method: payment_method;
}

export interface CreateTransactionPaymentSchedulesData {
  accountType: transaction_account_type;
  movementType: transaction_movement_type;
  operationType: transaction_operation_type;
  currency: transaction_currency;
  description: string;
  amount: number;
  amountFee: number;
  amountNet: number;
  sourceId: string;
  webhookStatus: payment_status;
  isVisible?: boolean;
  companyId: string;
  providerName: provider_name;
  method: payment_method;
  installments: number | null;
}
