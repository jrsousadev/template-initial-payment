import {
  company,
  company_tax_config,
  infraction_analysis_result,
  infraction_status,
  payment,
  payment_status,
  Prisma,
  provider,
  provider_name,
  provider_tax_config,
  queue_type,
  receiver_pix_type,
  receiver_type,
  wallet,
  webhook,
  withdrawal,
  withdrawal_status,
} from '@prisma/client';
import { CreateTransactionData } from 'src/modules/transaction/interfaces/transaction.interfaces';

export interface QueueBatchData {
  queueId: string;
  payload: Prisma.JsonValue | null;
}

export interface QueueTask {
  id: string;
  createdAt: Date;
  type: queue_type;
  payload: any;
  attempt: number;
}

export interface QueueResultTaskFailed {
  taskId: string;
  error: string;
}

export interface QueueTasksPaymentsProcessor {
  providerPaymentId: string;
  endToEndId?: string;
  webhookStatus: payment_status;
  providerResponse: any;
  queueTaskId: string;
}

export interface QueueTasksWithdrawalsProcessor {
  providerWithdrawalId: string;
  endToEndId?: string;
  webhookStatus: withdrawal_status;
  providerResponse: any;
  errorMessage?: string;
  amount?: number;
  queueTaskId: string;
}

export interface QueueTasksInfractionsProcessor {
  providerPaymentId: string;
  providerName: provider_name;
  providerInfractionId: string;
  analysisResult: infraction_analysis_result | undefined;
  analysisReason?: string;
  reason: string;
  providerResponse: any;
  endToEndId?: string;
  statusInfraction: infraction_status;
  queueTaskId: string;
}

export interface QueueTasksAnticipationsProcessor {
  anticipationId: string;
  queueTaskId: string;
}

export interface QueueTasksPaymentReleaseSchedulesProcessor {
  paymentReleaseScheduleId: string;
  queueTaskId: string;
}

export type IPaymentWithCompanyAndProvider = payment & {
  company: company & {
    company_tax_configs: company_tax_config[];
    webhooks: webhook[];
  };
  provider: provider & { provider_tax_config: provider_tax_config | null };
};

export type IWithdrawalWithCompanyAndProvider = withdrawal & {
  company: company & {
    company_tax_configs: company_tax_config[];
    webhooks: webhook[];
  };
  provider: provider & { provider_tax_config: provider_tax_config | null };
};

export interface PaymentsUpdates {
  paymentId: string;
  updateData: Prisma.paymentUpdateArgs['data'];
}

export interface AnticipationsUpdates {
  anticipationId: string;
  updateData: Prisma.anticipationUpdateArgs['data'];
}

export interface PaymentReleaseSchedulesUpdates {
  paymentReleaseScheduleId: string;
  updateData: Prisma.payment_release_scheduleUpdateArgs['data'];
}

export interface WithdrawalsUpdates {
  withdrawalId: string;
  updateData: Prisma.withdrawalUpdateArgs['data'];
}

export interface InfractionsUpdates {
  infractionId: string;
  updateData: Prisma.infractionUpdateArgs['data'];
}

export interface ProcessPaymentApprovedParams {
  payment: IPaymentWithCompanyAndProvider;
  paymentsUpdates: PaymentsUpdates[];
  transactionsToCreate: CreateTransactionData[];
  task: QueueTasksPaymentsProcessor;
  queueResultsSuccess: string[];
  webhooksPayloads: WebhookPayload[];
}

export interface WebhookPayload {
  payload: {
    event: string;
    data: any;
  };
  postbackUrl: string;
  secretKey: string;
  entityId: string;
  companyId: string;
  type: 'PAYMENT' | 'REFUND' | 'CHARGEBACK';
}

export interface BatchProcessResult {
  queueResultsSuccess: string[];
  queueResultsFailed: QueueResultTaskFailed[];
  webhooksPayloads: WebhookPayload[];
  transactionsCreated: number;
  refundsCreated: number;
}

export interface QueueTasksCallProviderWithdrawalBatch {
  queueId: string;
  payload: {
    withdrawalId: string;
    receiverType: receiver_type;
    pixType: receiver_pix_type;
    pixKey: string;
    receiverDocument: string;
    type: receiver_type;
  };
}

export interface WalletWithTimestamp extends wallet {
  seconds_since_update?: number;
}

export type typeMapWithdrawal = withdrawal & {
  companyName?: string;
  companyEmail?: string;
  companySignatureKeyWebhook?: string;
  infractionsBlockedAmount?: number;
};
