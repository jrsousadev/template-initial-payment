import { Injectable } from '@nestjs/common';
import { CalculateUtil } from 'src/common/utils/calculate.util';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { Company } from 'src/modules/company/entities/company.entity';
import { DevolutionsToCreateData } from 'src/modules/devolution/interfaces/devolution.interfaces';
import { CreateTransactionData } from 'src/modules/transaction/interfaces/transaction.interfaces';
import {
  IWithdrawalWithCompanyAndProvider,
  QueueResultTaskFailed,
  QueueTasksWithdrawalsProcessor,
  WithdrawalsUpdates,
} from '../interfaces/queue.interfaces';

@Injectable()
export class WithdrawalRefundedHandlerQueue {
  constructor(private readonly prisma: PrismaService) {}

  private calculateWithdrawalRefundFees(
    amount: number,
    rates: {
      taxCompany: number;
      feeCompany: number;
      taxProvider: number;
      feeProvider: number;
    },
  ) {
    const amountWithdrawal = CalculateUtil.calculateNetAmount(
      amount,
      rates.taxCompany,
      rates.feeCompany,
    );

    const amountWithdrawalWithTaxProvider = CalculateUtil.calculateNetAmount(
      amount,
      rates.taxProvider,
      rates.feeProvider,
    );

    const amountProvider = Math.floor(amount - amountWithdrawalWithTaxProvider);
    const amountOrganization = Math.floor(
      amount - amountWithdrawal - amountProvider,
    );

    return {
      amountWithdrawal,
      amountProvider,
      amountOrganization,
      totalFees: amount - amountWithdrawal,
    };
  }

  async execute({
    withdrawal,
    withdrawalsUpdates,
    transactionsToCreate,
    devolutionsToCreate,
    task,
    queueResultsFailed,
  }: {
    withdrawal: IWithdrawalWithCompanyAndProvider;
    withdrawalsUpdates: WithdrawalsUpdates[];
    transactionsToCreate: CreateTransactionData[];
    devolutionsToCreate: DevolutionsToCreateData[];
    task: QueueTasksWithdrawalsProcessor;
    queueResultsFailed: QueueResultTaskFailed[];
  }) {
    const now = new Date();
    const isValidDevolution = task.amount && task.amount === withdrawal.amount;

    if (!isValidDevolution) {
      queueResultsFailed.push({
        error: 'Invalid devolution amount',
        taskId: task.queueTaskId,
      });
      return;
    }

    const company = new Company(withdrawal.company);
    const companyTaxConfig = company.getTaxConfigByCurrency('BRL');

    if (!companyTaxConfig) {
      queueResultsFailed.push({
        error: 'Company tax config not found',
        taskId: task.queueTaskId,
      });
      return;
    }

    if (!withdrawal.provider.provider_tax_config) {
      queueResultsFailed.push({
        error: 'Provider tax config not found',
        taskId: task.queueTaskId,
      });
      return;
    }

    const { amountOrganization, amountProvider } =
      this.calculateWithdrawalRefundFees(withdrawal.amount, {
        feeCompany: companyTaxConfig.tax_fee_withdrawal,
        taxCompany: companyTaxConfig.tax_rate_withdrawal,
        feeProvider: withdrawal.provider.provider_tax_config.tax_fee_withdrawal,
        taxProvider:
          withdrawal.provider.provider_tax_config.tax_rate_withdrawal,
      });

    const taxWithdrawal = amountProvider + amountOrganization;
    const returnedAmount = withdrawal.amount + withdrawal.amount_fee;

    withdrawalsUpdates.push({
      withdrawalId: withdrawal.id,
      updateData: {
        refunded_at: now,
        status: 'REFUNDED',
        end_to_end_id: task.endToEndId,
      },
    });

    // TO DO lógica do "totalAmount"
    devolutionsToCreate.push({
      id: UniqueIDGenerator.generate(),
      amount: returnedAmount,
      amountProvider: amountProvider,
      amountOrganization: amountOrganization,
      amountFee: taxWithdrawal,
      companyId: withdrawal.company.id,
      taxFee: companyTaxConfig.tax_fee_withdrawal,
      taxRate: companyTaxConfig.tax_rate_withdrawal,
      taxFeeProvider:
        withdrawal.provider.provider_tax_config.tax_fee_withdrawal,
      taxRateProvider:
        withdrawal.provider.provider_tax_config.tax_rate_withdrawal,
      type: 'REFUND_OUT',
      withdrawalId: withdrawal.id,
    });

    transactionsToCreate.push({
      amount: withdrawal.amount,
      amountFee: withdrawal.amount - returnedAmount,
      companyId: withdrawal.company.id,
      accountType: 'BALANCE_AVAILABLE',
      currency: 'BRL',
      amountNet: returnedAmount,
      description: `Retorno de saque ${withdrawal.id}`,
      operationType: 'REFUND_OUT',
      method: 'PIX',
      movementType: 'CREDIT',
      sourceId: withdrawal.id,
      webhookStatus: 'REFUNDED',
    });
  }
}
