import { Injectable } from '@nestjs/common';
import { provider_tax_config } from '@prisma/client';
import { CalculateUtil } from 'src/common/utils/calculate.util';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { MoneyUtil } from 'src/common/utils/money.util';
import { Company } from 'src/modules/company/entities/company.entity';
import { DevolutionsToCreateData } from 'src/modules/devolution/interfaces/devolution.interfaces';
import { CreateTransactionData } from 'src/modules/transaction/interfaces/transaction.interfaces';
import {
  IPaymentWithCompanyAndProvider,
  PaymentsUpdates,
  QueueTasksPaymentsProcessor,
} from '../interfaces/queue.interfaces';

@Injectable()
export class PaymentRefundedHandlerQueue {
  async execute({
    payment,
    paymentsUpdates,
    transactionsToCreate,
    task,
    queueResultsSuccess,
    devolutionsToCreate,
    infractionsToCheck,
  }: {
    payment: IPaymentWithCompanyAndProvider;
    paymentsUpdates: PaymentsUpdates[];
    transactionsToCreate: CreateTransactionData[];
    task: QueueTasksPaymentsProcessor;
    queueResultsSuccess: string[];
    devolutionsToCreate: DevolutionsToCreateData[];
    infractionsToCheck: string[];
  }) {
    const now = new Date();
    const { provider, company } = payment;

    const providerTaxConfig =
      provider.provider_tax_config as provider_tax_config;

    const companyEntity = new Company(company);
    const companyTaxConfig = companyEntity.getTaxConfigByCurrency(
      payment.currency,
    );

    const paymentTotalAmount = payment.amount;
    const taxRefund =
      companyTaxConfig[`tax_rate_refund_${payment.method.toLowerCase()}`];
    const refundFee =
      companyTaxConfig[`tax_fee_refund_${payment.method.toLowerCase()}`];

    const taxRefundProvider =
      providerTaxConfig[`tax_rate_refund_${payment.method.toLowerCase()}`];
    const refundFeeProvider =
      providerTaxConfig[`tax_fee_refund_${payment.method.toLowerCase()}`];

    const amountDifference = paymentTotalAmount - payment.amount_net;

    const refundPenalty = CalculateUtil.calculateFeeAmount(
      payment.amount,
      taxRefund,
      refundFee,
    );

    const refundAmountProvider = CalculateUtil.calculateFeeAmount(
      payment.amount,
      taxRefundProvider,
      refundFeeProvider,
    );

    const refundAmountOrganization = refundPenalty - refundAmountProvider;

    devolutionsToCreate.push({
      id: UniqueIDGenerator.generate(),
      amount: refundPenalty + amountDifference + payment.amount_net,
      amountFee: refundPenalty,
      amountOrganization: refundAmountOrganization,
      amountProvider: refundAmountProvider,
      taxRate: taxRefund,
      taxFee: refundFee,
      taxFeeProvider: refundFeeProvider,
      taxRateProvider: taxRefundProvider,
      type: 'REFUND_IN',
      paymentId: payment.id,
      companyId: payment.company_id,
    });

    paymentsUpdates.push({
      paymentId: payment.id,
      updateData: {
        refunded_at: now,
        status: 'REFUNDED',
      },
    });

    // Reserva já foi liberada e Saldo já foi liberado
    if (
      payment.available_reserve_status === 'COMPLETED' &&
      payment.available_status === 'COMPLETED'
    ) {
      const amount = payment.amount_net;
      const fee = refundPenalty + amountDifference;
      const amountNet = amount + fee;

      transactionsToCreate.push({
        accountType: 'BALANCE_AVAILABLE',
        movementType: 'DEBIT',
        operationType: 'REFUND_IN',
        description: `Refunded payment ${payment.id}`,
        amount: MoneyUtil.negate(amount),
        amountFee: fee,
        amountNet: MoneyUtil.negate(amountNet),
        sourceId: payment.id,
        companyId: payment.company_id,
        currency: payment.currency,
        webhookStatus: 'REFUNDED',
        method: payment.method,
      });
    }

    // Reserva não foi liberada e saldo sim, ele remove o valor do balance sem reserva;
    // E remove o valor de reserva
    if (
      payment.available_reserve_status !== 'COMPLETED' &&
      payment.available_status === 'COMPLETED'
    ) {
      const amount = payment.amount_net;
      const reserve = payment.amount_reserve;
      const fee = refundPenalty + amountDifference;
      const amountNet = amount - reserve + fee;

      transactionsToCreate.push(
        {
          accountType: 'BALANCE_AVAILABLE',
          movementType: 'DEBIT',
          operationType: 'REFUND_IN',
          description: `Refunded payment ${payment.id}`,
          amount: MoneyUtil.negate(amount - reserve),
          amountFee: fee,
          amountNet: MoneyUtil.negate(amountNet),
          sourceId: payment.id,
          companyId: payment.company_id,
          currency: payment.currency,
          webhookStatus: 'REFUNDED',
          method: payment.method,
        },
        {
          accountType: 'BALANCE_RESERVE',
          movementType: 'DEBIT',
          operationType: 'REFUND_IN',
          description: `Refunded payment ${payment.id}`,
          amount: MoneyUtil.negate(reserve),
          amountFee: 0,
          amountNet: MoneyUtil.negate(reserve),
          sourceId: payment.id,
          companyId: payment.company_id,
          currency: payment.currency,
          webhookStatus: 'REFUNDED',
          method: payment.method,
        },
      );
    }

    // Reserva já foi liberada e saldo não, remove do newPendingBalance o amountSeller
    // E do newBalance remove a penalidade + o lucro da plataforma
    if (
      payment.available_reserve_status === 'COMPLETED' &&
      payment.available_status !== 'COMPLETED'
    ) {
      if (
        payment.method === 'CREDIT_CARD' &&
        payment.installments &&
        payment.installments !== payment.installments_qty_received
      ) {
        const amountInstallmentsReceived =
          payment.installments_amount_received as number;
        const amountInstallmentsPending =
          payment.installments_amount_pending as number;
        const fee = refundPenalty + amountDifference;
        const reserve = payment.amount_reserve;
        const amount = amountInstallmentsReceived + reserve;

        transactionsToCreate.push(
          {
            accountType: 'BALANCE_PENDING',
            movementType: 'DEBIT',
            operationType: 'REFUND_IN',
            description: `Refunded payment ${payment.id}`,
            amount: MoneyUtil.negate(amountInstallmentsPending),
            amountFee: 0,
            amountNet: MoneyUtil.negate(amountInstallmentsPending),
            sourceId: payment.id,
            companyId: payment.company_id,
            currency: payment.currency,
            webhookStatus: 'REFUNDED',
            method: payment.method,
          },
          {
            accountType: 'BALANCE_AVAILABLE',
            movementType: 'DEBIT',
            operationType: 'REFUND_IN',
            description: `Refunded payment ${payment.id}`,
            amount: MoneyUtil.negate(amount),
            amountFee: fee,
            amountNet: MoneyUtil.negate(
              amountInstallmentsReceived + fee + reserve,
            ),
            sourceId: payment.id,
            companyId: payment.company_id,
            currency: payment.currency,
            webhookStatus: 'REFUNDED',
            method: payment.method,
          },
        );
      } else {
        const amount = payment.amount_net;
        const fee = refundPenalty + amountDifference;
        const reserve = payment.amount_reserve;
        const amountNet = reserve + fee;

        transactionsToCreate.push(
          {
            accountType: 'BALANCE_AVAILABLE',
            movementType: 'DEBIT',
            operationType: 'REFUND_IN',
            description: `Refunded payment ${payment.id}`,
            amount: MoneyUtil.negate(reserve),
            amountFee: fee,
            amountNet: MoneyUtil.negate(amountNet),
            sourceId: payment.id,
            companyId: payment.company_id,
            currency: payment.currency,
            webhookStatus: 'REFUNDED',
            method: payment.method,
          },
          {
            accountType: 'BALANCE_PENDING',
            movementType: 'DEBIT',
            operationType: 'REFUND_IN',
            description: `Refunded payment ${payment.id}`,
            amount: MoneyUtil.negate(amount - reserve),
            amountFee: 0,
            amountNet: MoneyUtil.negate(amount - reserve),
            sourceId: payment.id,
            companyId: payment.company_id,
            currency: payment.currency,
            webhookStatus: 'REFUNDED',
            method: payment.method,
          },
        );
      }
    }

    // Reserva não foi liberada e saldo também não;
    // Remove do valor pendente
    // Remove do valor disponível as taxas
    // Remove da reserva
    if (
      payment.available_reserve_status !== 'COMPLETED' &&
      payment.available_status !== 'COMPLETED'
    ) {
      if (
        payment.method === 'CREDIT_CARD' &&
        payment.installments &&
        payment.installments !== payment.installments_qty_received
      ) {
        const amountInstallmentsReceived =
          payment.installments_amount_received as number;
        const amountInstallmentsPending =
          payment.installments_amount_pending as number;
        const fee = refundPenalty + amountDifference;
        const reserve = payment.amount_reserve;
        const balanceRemoveAvailable = fee + amountInstallmentsReceived;
        const balanceRemovePending = amountInstallmentsPending;

        transactionsToCreate.push(
          {
            accountType: 'BALANCE_AVAILABLE',
            movementType: 'DEBIT',
            operationType: 'REFUND_IN',
            description: `Refunded payment ${payment.id}`,
            amount: MoneyUtil.negate(amountInstallmentsReceived),
            amountFee: fee,
            amountNet: MoneyUtil.negate(balanceRemoveAvailable),
            sourceId: payment.id,
            companyId: payment.company_id,
            currency: payment.currency,
            webhookStatus: 'REFUNDED',
            method: payment.method,
          },
          {
            accountType: 'BALANCE_PENDING',
            movementType: 'DEBIT',
            operationType: 'REFUND_IN',
            description: `Refunded payment ${payment.id}`,
            amount: MoneyUtil.negate(balanceRemovePending),
            amountFee: 0,
            amountNet: MoneyUtil.negate(balanceRemovePending),
            sourceId: payment.id,
            companyId: payment.company_id,
            currency: payment.currency,
            webhookStatus: 'REFUNDED',
            method: payment.method,
          },
          {
            accountType: 'BALANCE_RESERVE',
            movementType: 'DEBIT',
            operationType: 'REFUND_IN',
            description: `Refunded payment ${payment.id}`,
            amount: MoneyUtil.negate(reserve),
            amountFee: 0,
            amountNet: MoneyUtil.negate(reserve),
            sourceId: payment.id,
            companyId: payment.company_id,
            currency: payment.currency,
            webhookStatus: 'REFUNDED',
            method: payment.method,
          },
        );
      } else {
        const amount = payment.amount_net;
        const fee = refundPenalty + amountDifference;
        const reserve = payment.amount_reserve;

        transactionsToCreate.push(
          {
            accountType: 'BALANCE_PENDING',
            movementType: 'DEBIT',
            operationType: 'REFUND_IN',
            description: `Refunded payment ${payment.id}`,
            amount: MoneyUtil.negate(amount - reserve),
            amountFee: 0,
            amountNet: MoneyUtil.negate(amount - reserve),
            sourceId: payment.id,
            companyId: payment.company_id,
            currency: payment.currency,
            webhookStatus: 'REFUNDED',
            method: payment.method,
          },
          {
            accountType: 'BALANCE_AVAILABLE',
            movementType: 'DEBIT',
            operationType: 'REFUND_IN',
            description: `Refunded payment ${payment.id}`,
            amount: 0,
            amountFee: fee,
            amountNet: MoneyUtil.negate(fee),
            sourceId: payment.id,
            companyId: payment.company_id,
            currency: payment.currency,
            webhookStatus: 'REFUNDED',
            method: payment.method,
          },
          {
            accountType: 'BALANCE_RESERVE',
            movementType: 'DEBIT',
            operationType: 'REFUND_IN',
            description: `Refunded payment ${payment.id}`,
            amount: MoneyUtil.negate(reserve),
            amountFee: 0,
            amountNet: MoneyUtil.negate(reserve),
            sourceId: payment.id,
            companyId: payment.company_id,
            currency: payment.currency,
            webhookStatus: 'REFUNDED',
            method: payment.method,
          },
        );
      }
    }

    infractionsToCheck.push(payment.id);
    queueResultsSuccess.push(task.queueTaskId);
  }
}
