import {
  provider_name,
  provider_environment,
  payment_status,
  withdrawal_status,
  receiver_pix_type,
  receiver_type,
  infraction_type,
  infraction_status,
  infraction_analysis_result,
} from '@prisma/client';

export interface CustomerData {
  document?: string;
  name: string;
  email: string;
  phone: string;
}

export interface CompanyData {
  id: string;
  document: string;
  name: string;
  email: string;
}

export interface CreatePaymentInput {
  customer: CustomerData;
  company: CompanyData;
  amount: number;
  description: string;
  myPaymentId: string;
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'BILLET';
  webhookUrl?: string;
  refererUrl?: string;
  checkoutUrl?: string;
  creditCard?: {
    number: string;
    holder: string;
    expMonth: string;
    expYear: string;
    cvv: string;
    installments: number;
  };
}

export interface PaymentResponse {
  providerPaymentId: string;
  status: payment_status;
  amount: number;
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'BILLET';
  pixCode?: string;
  billetUrl?: string;
  billetBarcode?: string;
  authCodeCreditCard?: string;
  expiresAt?: Date;
  endToEndId?: string;
  errorMessage?: string;
  providerResponse?: any;
}

export interface RefundPaymentInput {
  providerPaymentId: string;
  endToEndId?: string;
  myPaymentId: string;
  amount: number;
}

export interface BalanceResponse {
  available: number;
  blocked: number;
  pending: number;
  reserved: number;
  total: number;
}

export interface WithdrawalData {
  myWithdrawalId: string;
  methodType: receiver_type;
  pixType: receiver_pix_type;
  pixKey: string;
  amount: number;
  receiverDocument: string;
  webhookUrl: string;
  providerResponse?: any;
}

export interface WithdrawalResponse {
  providerWithdrawalId: string;
  status: withdrawal_status;
  amount: number;
  approvedAt?: Date;
  providerResponse?: any;
  endToEndId?: string;
  errorMessage?: string;
}

export interface WebhookDataBase {
  type: 'PAYMENT' | 'WITHDRAWAL' | 'INFRACTION';
  providerResponse?: any;
}

export interface PaymentWebhookData extends WebhookDataBase {
  type: 'PAYMENT';
  providerPaymentId: string;
  webhookStatus: payment_status;
  // payerRealName?: string;
  // payerRealDocument?: string;
  pixKey?: string;
  amount?: number;
  endToEndId?: string;
  authCodeCreditCard?: string;
  binCreditCard?: string;
  last4CreditCard?: string;
  providerId?: string;
}

export interface WithdrawalWebhookData extends WebhookDataBase {
  type: 'WITHDRAWAL';
  webhookStatus: withdrawal_status;
  providerWithdrawalId: string;
  // receiverName?: string;
  // receiverDocument?: string;
  amount?: number;
  errorMessage?: string;
  endToEndId?: string;
}

export interface InfractionWebhookData extends WebhookDataBase {
  type: 'INFRACTION';

  infractionType: infraction_type;
  infractionAnalysisResult: infraction_analysis_result | undefined;
  infractionStatus: infraction_status;

  providerInfractionId: string;
  providerPaymentId?: string;
  infractionReason: string;
  analysisReason?: string;
}

export type WebhookData =
  | PaymentWebhookData
  | WithdrawalWebhookData
  | InfractionWebhookData;

export abstract class BasePaymentProvider {
  constructor(
    protected publicKeyCashin: string | null,
    protected secretKeyCashin: string,
    protected publicKeyCashout: string | null,
    protected secretKeyCashout: string | null,
    protected certCrtCashin: string | null,
    protected certKeyCashin: string | null,
    protected certCrtCashout: string | null,
    protected certKeyCashout: string | null,
    protected receiverId: string | null,
    protected environment: provider_environment | null,
    public baseUrl: string | null,
  ) {}

  static providerName: provider_name;

  processWebhook(data: any): WebhookData | undefined {
    throw new Error('Method not implemented.');
  }
  static verifyWebhookSecret(secret: string): boolean {
    throw new Error('Method not implemented.');
  }
  static parseStatus(status: string): payment_status {
    throw new Error('Method not implemented.');
  }
  static parseWithdrawalStatus(status: string): withdrawal_status {
    throw new Error('Method not implemented.');
  }
  static parseInfractionStatus(status: string): infraction_status {
    throw new Error('Method not implemented.');
  }
  static parseInfractionAnalysisResultStatus(
    status: string,
  ): infraction_analysis_result | undefined {
    throw new Error('Method not implemented.');
  }

  // payments
  abstract createPayment(input: CreatePaymentInput): Promise<PaymentResponse>;
  abstract getPayment(paymentId: string): Promise<PaymentResponse>;
  abstract refundPayment(input: RefundPaymentInput): Promise<PaymentResponse>;

  // balances
  abstract getBalance(): Promise<BalanceResponse>;
  abstract getBalanceBlocked(): Promise<{ blocked: number }>;

  // withdrawals
  abstract createWithdrawal(input: WithdrawalData): Promise<WithdrawalResponse>;
  abstract getWithdrawal(
    withdrawalId: string,
    endToEndId?: string,
  ): Promise<WithdrawalResponse>;

  // (TO DO) get infractions
}
