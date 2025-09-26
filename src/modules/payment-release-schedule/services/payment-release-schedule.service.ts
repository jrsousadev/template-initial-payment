// payment-release-schedule.service.ts
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  payment_release_schedule,
  release_schedule_type,
} from '@prisma/client';
import { CreatePaymentReleaseScheduleData } from '../interfaces/payment-release-schedule.interfaces';
import { PaymentReleaseScheduleRepository } from '../repositories/payment-release-schedule.repository';

@Injectable()
export class PaymentReleaseScheduleService {
  constructor(private repository: PaymentReleaseScheduleRepository) {}

  async createSchedulesForPayment(
    schedules: CreatePaymentReleaseScheduleData[],
    tx: Prisma.TransactionClient | null,
  ) {
    const inputs: Prisma.payment_release_scheduleCreateManyInput[] =
      schedules.map((schedule) => ({
        amount_fee: schedule.amountFee,
        amount_gross: schedule.amountGross,
        amount_net: schedule.amountNet,
        company_id: schedule.companyId,
        payment_id: schedule.paymentId,
        scheduled_date: schedule.scheduledDate,
        type: schedule.type,
        is_anticipatable: schedule.isAnticipatable,
        error_message: schedule.errorMessage,
        installment_number: schedule.installmentNumber,
        total_installments: schedule.totalInstallments,
        currency: schedule.currency,
        method: schedule.method,
        provider_name: schedule.providerName,
        is_anticipation_available_date: schedule.isAnticipationAvailableDate,
      }));
    return await this.repository.bulkCreate(inputs, tx);
  }

  public getDescription(schedule: payment_release_schedule): string {
    const descriptions = {
      INSTALLMENT: `Parcela ${schedule.installment_number}/${schedule.total_installments} - Pagamento recebido - ${schedule.payment_id}`,
      RESERVE_RELEASE: `Liberação de reserva - ${schedule.payment_id}`,
      PENDING_TO_AVAILABLE: `Liberação de saldo - ${schedule.payment_id}`,
    };

    return descriptions[schedule.type];
  }

  public getSourceAccount(
    type: release_schedule_type,
  ): 'BALANCE_PENDING' | 'BALANCE_RESERVE' {
    return type === 'RESERVE_RELEASE' ? 'BALANCE_RESERVE' : 'BALANCE_PENDING';
  }

  async handleRefund(paymentId: string) {
    await this.repository.cancelByPaymentId(paymentId);
  }
}
