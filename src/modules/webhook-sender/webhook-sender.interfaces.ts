import {
  payment_status,
  withdrawal_status,
  webhook,
  webhook_type,
  infraction_status,
  infraction_analysis_result,
} from '@prisma/client';

interface IPaymentBuilder {
  id: string;
  external_id: string | null;
  end_to_end_id: string | null;
  amount: number;
  status: payment_status;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  customer_document: string | null;
  company_id: string;
}

interface IWithdrawalBuilder {
  id: string;
  external_id: string | null;
  end_to_end_id: string | null;
  amount: number;
  status: withdrawal_status;
  company_id: string;
}

interface IInfractionBuilder {
  id: string;

  status: infraction_status;
  analysis_result: infraction_analysis_result | null;
  analysis_reason: string | null;
  reason: string;
  
  closed_at: Date | null;
  cancelled_at: Date | null;
  responsed_at: Date | null;
  defended_at: Date | null;
  created_at: Date;
  
  payment_id: string;
  company_id: string;
}
export interface IBuildWebhookPaymentsPayloadParams {
  payment: IPaymentBuilder;
}

export interface IBuildWebhookWithdrawalsPayloadParams {
  withdrawal: IWithdrawalBuilder;
}

export interface IBuildWebhookInfractionsPayloadParams {
  infraction: IInfractionBuilder;
}

export interface ICreateWebhooksLogsBase {
  type: webhook_type;
  webhook: webhook;
}

export interface ICreateWebhookLogsParamsPayment
  extends ICreateWebhooksLogsBase {
  type: 'PAYMENT';
  payment: IPaymentBuilder;
}

export interface ICreateWebhookLogsParamsRefundIn
  extends ICreateWebhooksLogsBase {
  type: 'REFUND_IN';
  payment: IPaymentBuilder;
}

export interface ICreateWebhookLogsParamsWithdrawal
  extends ICreateWebhooksLogsBase {
  type: 'WITHDRAWAL';
  withdrawal: IWithdrawalBuilder;
}

export interface ICreateWebhookLogsParamsInfraction
  extends ICreateWebhooksLogsBase {
  type: 'INFRACTION';
  infraction: IInfractionBuilder;
}

export interface ICreateWebhookLogsParamsRefundOut
  extends ICreateWebhooksLogsBase {
  type: 'REFUND_OUT';
  withdrawal: IWithdrawalBuilder;
}

export type CreateWebhookLogsParamsData =
  | ICreateWebhookLogsParamsPayment
  | ICreateWebhookLogsParamsWithdrawal
  | ICreateWebhookLogsParamsInfraction
  | ICreateWebhookLogsParamsRefundIn
  | ICreateWebhookLogsParamsRefundOut;

export interface IWebhookBuilded {
  id: string;
  url: string;
  payload: any;
  type: webhook_type;
  company_id: string;
  payment_id?: string;
  withdrawal_id?: string;
}

export interface IWebhooksWithIds {
  id: string;
  company_id: string;
  webhook_id: string;
  payment_id?: string;
  infraction_id?: string;
  withdrawal_id?: string;
  payload: any;
  url: string;
  type: webhook_type;
}
