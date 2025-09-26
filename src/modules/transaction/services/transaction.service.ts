// transaction.service.ts
import { Injectable } from '@nestjs/common';
import {
  payment_status,
  Prisma,
  transaction_account_type,
  transaction_movement_type,
  transaction_operation_type,
} from '@prisma/client';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { Transaction } from '../entities/transaction.entity';
import {
  CreateTransactionData,
  CreateTransactionPaymentSchedulesData,
} from '../interfaces/transaction.interfaces';
import { TransactionRepository } from '../repositories/transaction.repository';

@Injectable()
export class TransactionService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  private createIdempotencyKey(data: {
    sourceId: string;
    webhookStatus: payment_status;
    operationType: transaction_operation_type;
    accountType: transaction_account_type;
    movementType: transaction_movement_type;
    installments?: number;
  }): string {
    const {
      sourceId,
      webhookStatus,
      operationType,
      accountType,
      movementType,
      installments,
    } = data;

    const idempotencyKey = `${sourceId}-${webhookStatus}-${operationType}-${accountType}-${movementType}`;

    if (installments) {
      return `${idempotencyKey}-${installments}`;
    }

    if (idempotencyKey.length > 255) {
      throw new Error(
        'Idempotency key exceeds maximum length of 255 characters',
      );
    }

    return idempotencyKey;
  }

  async createMany({
    tx,
    sourceId,
    transactions,
  }: {
    tx: Prisma.TransactionClient;
    sourceId: string;
    transactions: CreateTransactionData[];
  }) {
    if (transactions.length === 0) {
      return { created: 0, duplicates: 0 };
    }

    const now = new Date();

    const transactionsInputs = transactions.map((tx) => {
      const idempotencyKey = this.createIdempotencyKey({
        sourceId: tx.sourceId || sourceId,
        webhookStatus: tx.webhookStatus,
        operationType: tx.operationType,
        accountType: tx.accountType,
        movementType: tx.movementType,
      });

      const input = {
        id: UniqueIDGenerator.generate(),
        source_id: tx.sourceId || sourceId,
        description: tx.description || null,
        visible: tx.isVisible ?? true,
        is_checkpoint: false,
        amount: tx.amount,
        amount_fee: tx.amountFee || 0,
        amount_net: tx.amountNet,
        idempotency_key: idempotencyKey,
        currency: tx.currency,
        operation_type: tx.operationType,
        account_type: tx.accountType,
        movement_type: tx.movementType,
        company_id: tx.companyId,
        method: tx.method,
        created_at: now,
        updated_at: now,
      };

      new Transaction(input);

      return input;
    });

    try {
      const result = await this.transactionRepository.createMany(
        transactionsInputs,
        tx,
      );

      const duplicates = transactions.length - result.count;

      if (duplicates > 0) {
        console.log(`⚠️  Skipped ${duplicates} duplicate transactions`);
      }

      return {
        created: result.count,
        duplicates: duplicates,
      };
    } catch (error: any) {
      console.error('Error creating transactions:', error);
      throw new Error('Failed to create transactions');
    }
  }

  async createManyPaymentSchedules({
    tx,
    sourceId,
    transactions,
  }: {
    tx: Prisma.TransactionClient;
    sourceId: string;
    transactions: CreateTransactionPaymentSchedulesData[];
  }) {
    if (transactions.length === 0) {
      return { created: 0, duplicates: 0 };
    }

    const now = new Date();

    const transactionsInputs = transactions.map((tr) => {
      const idempotencyKey = this.createIdempotencyKey({
        sourceId: tr.sourceId || sourceId,
        webhookStatus: tr.webhookStatus,
        operationType: tr.operationType,
        accountType: tr.accountType,
        movementType: tr.movementType,
        installments: tr.installments ?? undefined,
      });

      const input = {
        id: UniqueIDGenerator.generate(),
        source_id: tr.sourceId || sourceId,
        description: tr.description || null,
        visible: tr.isVisible ?? true,
        is_checkpoint: false,
        amount: tr.amount,
        amount_fee: tr.amountFee || 0,
        amount_net: tr.amountNet,
        idempotency_key: idempotencyKey,
        currency: tr.currency,
        operation_type: tr.operationType,
        account_type: tr.accountType,
        movement_type: tr.movementType,
        company_id: tr.companyId,
        provider_name: tr.providerName,
        method: tr.method,
        created_at: now,
        updated_at: now,
      };

      new Transaction(input);

      return input;
    });

    try {
      const result = await this.transactionRepository.createMany(
        transactionsInputs,
        tx,
      );

      const duplicates = transactions.length - result.count;

      if (duplicates > 0) {
        console.log(`⚠️  Skipped ${duplicates} duplicate transactions`);
      }

      return {
        created: result.count,
        duplicates: duplicates,
      };
    } catch (error: any) {
      console.error('Error creating transactions:', error);
      throw new Error('Failed to create transactions');
    }
  }
}
