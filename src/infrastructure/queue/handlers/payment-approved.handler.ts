import { Injectable } from '@nestjs/common';
import { addDays } from 'date-fns';
import { MoneyUtil } from 'src/common/utils/money.util';
import { Company } from 'src/modules/company/entities/company.entity';
import { CreatePaymentReleaseScheduleData } from 'src/modules/payment-release-schedule/interfaces/payment-release-schedule.interfaces';
import { CreateTransactionData } from 'src/modules/transaction/interfaces/transaction.interfaces';
import {
  IPaymentWithCompanyAndProvider,
  PaymentsUpdates,
  QueueTasksPaymentsProcessor,
} from '../interfaces/queue.interfaces';

@Injectable()
export class PaymentApprovedHandlerQueue {
  async execute({
    payment,
    paymentsUpdates,
    transactionsToCreate,
    paymentsReleaseScheduleToCreate,
    task,
    queueResultsSuccess,
  }: {
    payment: IPaymentWithCompanyAndProvider;
    paymentsUpdates: PaymentsUpdates[];
    transactionsToCreate: CreateTransactionData[];
    task: QueueTasksPaymentsProcessor;
    queueResultsSuccess: string[];
    paymentsReleaseScheduleToCreate: CreatePaymentReleaseScheduleData[];
  }) {
    const now = new Date();
    const { company } = payment;

    const companyEntity = new Company(company);
    const companyTaxConfig = companyEntity.getTaxConfigByCurrency(
      payment.currency,
    );

    const availableAntecipateAt =
      payment.method === 'CREDIT_CARD'
        ? addDays(now, companyTaxConfig.available_days_anticipation)
        : null;

    paymentsUpdates.push({
      paymentId: payment.id,
      updateData: {
        approved_at: now,
        status: 'APPROVED',
        end_to_end_id: task.endToEndId,
        available_anticipation_at: availableAntecipateAt,
      },
    });

    if (payment.method === 'PIX' || payment.method === 'BILLET') {
      const reserve = payment.amount_reserve;
      const amount = payment.amount;
      const fee = payment.amount_fee;
      const amountNet = payment.amount - payment.amount_fee;

      if (
        payment.completed_available_date &&
        now < payment.completed_available_date
      ) {
        paymentsReleaseScheduleToCreate.push({
          paymentId: payment.id,
          amountGross: amount,
          amountFee: fee,
          amountNet: amountNet,
          scheduledDate: payment.completed_available_date,
          type: 'PENDING_TO_AVAILABLE',
          companyId: payment.company_id,
          anticipationDiscount: 0,
          isAnticipatable: false,
          currency: payment.currency,
          method: payment.method,
          providerName: payment.provider_name,
          isAnticipationAvailableDate: availableAntecipateAt,
        });
        transactionsToCreate.push({
          accountType: 'BALANCE_PENDING',
          movementType: 'CREDIT',
          operationType: 'PAYMENT',
          description: `Pagamento recebido - ${payment.id}`,
          amount: amount,
          amountFee: fee,
          amountNet: amountNet,
          companyId: payment.company_id,
          sourceId: payment.id,
          currency: payment.currency,
          webhookStatus: 'APPROVED',
          method: payment.method,
        });
      } else {
        transactionsToCreate.push({
          accountType: 'BALANCE_AVAILABLE',
          movementType: 'CREDIT',
          operationType: 'PAYMENT',
          description: `Pagamento recebido - ${payment.id}`,
          amount: amount,
          amountFee: fee,
          amountNet: amountNet,
          companyId: payment.company_id,
          sourceId: payment.id,
          webhookStatus: 'APPROVED',
          currency: payment.currency,
          method: payment.method,
        });
      }

      if (
        reserve > 0 &&
        payment.completed_available_date &&
        now < payment.completed_available_date
      ) {
        paymentsReleaseScheduleToCreate.push({
          paymentId: payment.id,
          amountGross: reserve,
          amountFee: 0,
          amountNet: reserve,
          scheduledDate: payment.completed_reserve_available_date as Date,
          type: 'RESERVE_RELEASE',
          companyId: payment.company_id,
          anticipationDiscount: 0,
          isAnticipatable: false,
          currency: payment.currency,
          method: payment.method,
          providerName: payment.provider_name,
          isAnticipationAvailableDate: null,
        });
        transactionsToCreate.push(
          {
            accountType: 'BALANCE_PENDING',
            movementType: 'DEBIT',
            operationType: 'RESERVE',
            description: `Pendente > Reserva - ${payment.id}`,
            amount: MoneyUtil.negate(reserve),
            amountFee: 0,
            amountNet: MoneyUtil.negate(reserve),
            companyId: payment.company_id,
            sourceId: payment.id,
            webhookStatus: 'APPROVED',
            currency: payment.currency,
            method: payment.method,
          },
          {
            accountType: 'BALANCE_RESERVE',
            movementType: 'CREDIT',
            operationType: 'RESERVE',
            description: `Pendente > Reserva - ${payment.id}`,
            amount: reserve,
            amountFee: 0,
            amountNet: reserve,
            companyId: payment.company_id,
            sourceId: payment.id,
            webhookStatus: 'APPROVED',
            currency: payment.currency,
            method: payment.method,
          },
        );
      }

      if (reserve > 0 && !payment.completed_available_date) {
        paymentsReleaseScheduleToCreate.push({
          paymentId: payment.id,
          amountGross: reserve,
          amountFee: 0,
          amountNet: reserve,
          scheduledDate: payment.completed_reserve_available_date as Date,
          type: 'RESERVE_RELEASE',
          companyId: payment.company_id,
          anticipationDiscount: 0,
          isAnticipatable: false,
          currency: payment.currency,
          method: payment.method,
          providerName: payment.provider_name,
          isAnticipationAvailableDate: availableAntecipateAt,
        });
        transactionsToCreate.push(
          {
            accountType: 'BALANCE_AVAILABLE',
            movementType: 'DEBIT',
            operationType: 'RESERVE',
            description: `Disponível > Reserva - ${payment.id}`,
            amount: MoneyUtil.negate(reserve),
            amountFee: 0,
            amountNet: MoneyUtil.negate(reserve),
            companyId: payment.company_id,
            sourceId: payment.id,
            webhookStatus: 'APPROVED',
            currency: payment.currency,
            method: payment.method,
          },
          {
            accountType: 'BALANCE_RESERVE',
            movementType: 'CREDIT',
            operationType: 'RESERVE',
            description: `Disponível > Reserva - ${payment.id}`,
            amount: reserve,
            amountFee: 0,
            amountNet: reserve,
            companyId: payment.company_id,
            sourceId: payment.id,
            webhookStatus: 'APPROVED',
            currency: payment.currency,
            method: payment.method,
          },
        );
      }
    }

    if (payment.method === 'CREDIT_CARD' && payment.installments) {
      const reserve = payment.amount_reserve;
      const amount = payment.amount;
      const fee = payment.amount_fee;
      const amountNet = payment.amount - payment.amount_fee;
      const baseAmount = amountNet - reserve;
      const installments = payment.installments;

      for (let i = 0; i < installments; i++) {
        const perInstallmentGross = Math.floor(amount / installments);
        const perInstallmentFee = Math.floor(fee / installments);
        const perInstallmentNet = Math.floor(baseAmount / installments);

        const lastGross = amount - perInstallmentGross * (installments - 1);
        const lastFee = fee - perInstallmentFee * (installments - 1);
        const lastNet = baseAmount - perInstallmentNet * (installments - 1);

        const isLast = i === payment.installments - 1;

        paymentsReleaseScheduleToCreate.push({
          paymentId: payment.id,
          type: 'INSTALLMENT',
          amountGross: isLast ? lastGross : perInstallmentGross,
          amountFee: isLast ? lastFee : perInstallmentFee,
          amountNet: isLast ? lastNet : perInstallmentNet,
          installmentNumber: i + 1,
          totalInstallments: payment.installments,
          companyId: payment.company_id,
          scheduledDate: addDays(
            payment.approved_at || new Date(),
            30 * (i + 1), // D+30, D+60, D+90...
          ),
          isAnticipatable: true,
          anticipationDiscount: 0,
          currency: payment.currency,
          method: payment.method,
          providerName: payment.provider_name,
          isAnticipationAvailableDate: availableAntecipateAt,
        });
      }

      transactionsToCreate.push({
        accountType: 'BALANCE_PENDING',
        movementType: 'CREDIT',
        operationType: 'PAYMENT',
        description: `Pagamento recebido - ${payment.id}`,
        amount: amount,
        amountFee: fee,
        amountNet: amountNet,
        companyId: payment.company_id,
        sourceId: payment.id,
        webhookStatus: 'APPROVED',
        currency: payment.currency,
        method: payment.method,
      });

      if (reserve > 0) {
        paymentsReleaseScheduleToCreate.push({
          paymentId: payment.id,
          amountGross: reserve,
          amountFee: 0,
          amountNet: reserve,
          scheduledDate: payment.completed_reserve_available_date as Date,
          type: 'RESERVE_RELEASE',
          companyId: payment.company_id,
          anticipationDiscount: 0,
          isAnticipatable: false,
          currency: payment.currency,
          method: payment.method,
          providerName: payment.provider_name,
          isAnticipationAvailableDate: null,
        });
        transactionsToCreate.push(
          {
            accountType: 'BALANCE_PENDING',
            movementType: 'DEBIT',
            operationType: 'RESERVE',
            description: `Pendente > Reserva - ${payment.id}`,
            amount: MoneyUtil.negate(reserve),
            amountFee: 0,
            amountNet: MoneyUtil.negate(reserve),
            companyId: payment.company_id,
            sourceId: payment.id,
            webhookStatus: 'APPROVED',
            currency: payment.currency,
            method: payment.method,
          },
          {
            accountType: 'BALANCE_RESERVE',
            movementType: 'CREDIT',
            operationType: 'RESERVE',
            description: `Pendente > Reserva - ${payment.id}`,
            amount: reserve,
            amountFee: 0,
            amountNet: reserve,
            companyId: payment.company_id,
            sourceId: payment.id,
            webhookStatus: 'APPROVED',
            currency: payment.currency,
            method: payment.method,
          },
        );
      }
    }

    queueResultsSuccess.push(task.queueTaskId);
  }
}
