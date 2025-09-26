import {
  $Enums,
  transaction as PrismaTransaction,
  provider_name,
} from '@prisma/client';

export class Transaction implements PrismaTransaction {
  id: string;
  source_id: string | null;
  description: string | null;
  visible: boolean;
  amount: number;
  amount_fee: number;
  amount_net: number;
  idempotency_key: string;
  currency: $Enums.transaction_currency;
  operation_type: $Enums.transaction_operation_type;
  account_type: $Enums.transaction_account_type;
  movement_type: $Enums.transaction_movement_type;
  is_checkpoint: boolean;
  company_id: string;
  created_at: Date;
  updated_at: Date;
  provider_name: provider_name;
  method: $Enums.payment_method;

  constructor(data: PrismaTransaction) {
    this.validate(data);
    Object.assign(this, data);
  }

  private validate(data: PrismaTransaction): void {
    if (data.amount_net !== data.amount - data.amount_fee) {
      console.log(data);
      throw new Error('Invalid net amount calculation - transaction entity');
    }

    if (data.idempotency_key.length < 10) {
      throw new Error('Invalid idempotency key - transaction entity');
    }

    if (!data.idempotency_key) {
      throw new Error('Idempotency key is required - transaction entity');
    }
  }
}
