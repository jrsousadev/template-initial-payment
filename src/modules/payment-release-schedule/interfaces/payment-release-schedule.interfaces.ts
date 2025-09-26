import {
  payment_method,
  payment_release_schedule,
  provider_name,
  transaction_currency,
} from '@prisma/client';

export interface CreatePaymentReleaseScheduleData {
  paymentId: string;
  amountFee: number;
  amountGross: number;
  amountNet: number;
  scheduledDate: Date;
  type: payment_release_schedule['type'];
  companyId: string;
  anticipationDiscount: number;
  isAnticipatable: boolean;
  errorMessage?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  originalScheduledDate?: Date | null;
  method: payment_method;
  currency: transaction_currency;
  providerName: provider_name;
  isAnticipationAvailableDate: Date | null;
}
