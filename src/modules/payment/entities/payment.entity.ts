import {
  $Enums,
  payment as PrismaPayment,
  provider_name,
} from '@prisma/client';
import { IPaymentResponse } from '../interfaces/transaction.interfaces';
import { JsonValue } from '@prisma/client/runtime/library';

export class Payment implements PrismaPayment {
  id: string;
  external_id: string | null;
  provider_transaction_id: string;
  end_to_end_id: string | null;
  currency: $Enums.transaction_currency;
  description: string | null;
  amount_provider: number;
  amount_reserve: number;
  customer_name: string;
  customer_document: string;
  customer_email: string;
  customer_phone: string;
  customer_document_type: $Enums.customer_document_type;
  pix_code: string | null;
  billet_url: string | null;
  billet_barcode: string | null;
  type: $Enums.payment_type;
  brand_credit_card: $Enums.payment_credit_card_brand | null;
  last_four_digits_credit_card: string | null;
  bin_credit_card: string | null;
  auth_code_credit_card: string | null;
  responsible_external_id: string | null;
  responsible_external_document: string | null;
  ips: string[];
  refunded_provider_log: any;
  create_provider_log: any;
  approve_provider_log: any;
  error_message: string | null;
  provider_payment_id: string;
  tax_rate_company: number;
  tax_fee_company: number;
  tax_rate_reserve_company: number;
  tax_fee_reserve_company: number;
  tax_rate_anticipation: number;
  tax_fee_anticipation: number;
  tax_rate_provider: number;
  tax_fee_provider: number;
  referer_url: string | null;
  checkout_url: string | null;
  provider_name: provider_name;
  status: $Enums.payment_status;
  method: $Enums.payment_method;
  available_status: $Enums.payment_available_status;
  completed_available_date: Date | null;
  available_reserve_status: $Enums.payment_reserve_available_status;
  completed_reserve_available_date: Date | null;
  installments: number | null;
  installments_qty_received: number | null;
  installments_amount_received: number | null;
  installments_amount_pending: number | null;
  amount_per_installments: number | null;
  approved_at: Date | null;
  refunded_at: Date | null;
  refused_at: Date | null;
  chargedback_at: Date | null;
  refunded_processing_at: Date | null;
  disputed_at: Date | null;
  expired_at: Date | null;
  failed_at: Date | null;
  error_system_at: Date | null;
  available_anticipation_at: Date | null;
  anticipated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  amount: number;
  amount_net: number;
  amount_fee: number;
  amount_organization: number;
  company_id: string;
  company_api_key_id: string;
  provider_id: string;
  customer_id: string;
  address_zipcode: string | null;
  address_city: string | null;
  address_state: string | null;
  address_complement: string | null;
  address_street: string | null;
  address_district: string | null;
  address_number: string | null;
  address_country: string | null;
  items_json: JsonValue;

  constructor(data: PrismaPayment) {
    this.validate(data);
    Object.assign(this, data);
  }

  // MÉTODO PRIVADO - não expõe pra fora

  private validate(data: PrismaPayment): void {
    if (data.amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    if (data.amount_net !== data.amount - data.amount_fee) {
      throw new Error('Invalid net amount calculation - payment entity');
    }

    if (data.amount_fee < 0) {
      throw new Error('Fees cannot be negative - payment entity');
    }
  }

  private transitionTo(newStatus: $Enums.payment_status): void {
    const validTransitions: Record<
      $Enums.payment_status,
      $Enums.payment_status[]
    > = {
      PENDING: ['EXPIRED', 'ERROR_SYSTEM', 'APPROVED'],
      REFUNDED_PROCESSING: ['REFUNDED', 'ERROR_SYSTEM'],
      APPROVED: [
        'REFUNDED',
        'CHARGEDBACK',
        'IN_DISPUTE',
        'ERROR_SYSTEM',
        'REFUNDED_PROCESSING',
      ],
      FAILED: ['ERROR_SYSTEM'],
      REFUNDED: ['ERROR_SYSTEM'],
      CHARGEDBACK: ['ERROR_SYSTEM'],
      EXPIRED: ['ERROR_SYSTEM'],
      REFUSED: ['ERROR_SYSTEM'],
      IN_DISPUTE: [
        'APPROVED',
        'REFUNDED',
        'CHARGEDBACK',
        'REFUNDED_PROCESSING',
      ],
      ERROR_SYSTEM: ['ERROR_SYSTEM'],
    };

    if (!validTransitions[this.status].includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${this.status} to ${newStatus}`,
      );
    }

    this.status = newStatus;
    this.updated_at = new Date();
  }

  // MÉTODOS PÚBLICOS QUE USAM transitionTo INTERNAMENTE

  markAsApproved(): void {
    this.transitionTo('APPROVED');
    this.approved_at = new Date();
  }

  markAsRefused(): void {
    this.transitionTo('REFUSED');
    this.refused_at = new Date();
  }

  markAsRefunded(): void {
    this.transitionTo('REFUNDED');
    this.refunded_at = new Date();
  }

  markAsRefundedProcessing(): void {
    this.transitionTo('REFUNDED_PROCESSING');
    this.refunded_processing_at = new Date();
  }

  markAsChargedback(): void {
    this.transitionTo('CHARGEDBACK');
    this.chargedback_at = new Date();
  }

  markAsExpired(): void {
    this.transitionTo('EXPIRED');
    this.expired_at = new Date();
  }

  markAsInDispute(): void {
    this.transitionTo('IN_DISPUTE');
    this.disputed_at = new Date();
  }

  markAsErrorSystem(): void {
    this.transitionTo('ERROR_SYSTEM');
    this.error_system_at = new Date();
  }

  markAsFailed(): void {
    this.transitionTo('FAILED');
    this.failed_at = new Date();
  }

  // MÉTODOS DE CÁLCULO E VALIDAÇÃO

  isExpired(): boolean {
    if (!this.expired_at) return true;

    if (this.method === 'PIX') {
      return Date.now() > this.expired_at.getTime();
    }

    if (this.method === 'BILLET') {
      return Date.now() > this.expired_at.getTime();
    }

    return false;
  }

  // MÉTODOS DE VERIFICAÇÃO (não mudam estado)

  canApprove(): boolean {
    return (
      (this.status === 'PENDING' && this.approved_at === null) ||
      (this.status === 'APPROVED' && this.approved_at === null)
    );
  }

  canRefund(): boolean {
    if (
      (this.approved_at || this.refunded_processing_at) &&
      (this.status === 'APPROVED' ||
        this.status === 'REFUNDED_PROCESSING' ||
        this.status === 'IN_DISPUTE') &&
      this.refunded_at === null
    ) {
      return true;
    }

    return false;
  }

  canChargedback(): boolean {
    return (
      (this.status === 'APPROVED' || this.status === 'IN_DISPUTE') &&
      !this.chargedback_at
    );
  }

  canCancel(): boolean {
    return this.status === 'PENDING';
  }

  canDispute(): boolean {
    return this.status === 'APPROVED';
  }

  // MÉTODO PARA SERIALIZAÇÃO

  toJSON(): IPaymentResponse {
    return {
      id: this.id,
      external_id: this.external_id,
      end_to_end_id: this.end_to_end_id,

      amount: this.amount,
      status: this.status,
      method: this.method,

      currency: this.currency,

      description: this.description,
      type: this.type,

      items: this.items_json as any[],
      customer: {
        name: this.customer_name,
        document: {
          number: this.customer_document,
        },
        email: this.customer_email,
        phone: this.customer_phone,
      },
      address: {
        zipcode: this.address_zipcode,
        city: this.address_city,
        state: this.address_state,
        complement: this.address_complement,
        street: this.address_street,
        district: this.address_district,
        number: this.address_number,
        country: this.address_country,
      },
      pix: {
        code: this.pix_code,
        expired_at: this.expired_at,
      },
      billet: {
        url: this.billet_url,
        barcode: this.billet_barcode,
      },
      credit_card: {
        brand: this.brand_credit_card,
        last_four_digits: this.last_four_digits_credit_card,
        bin: this.bin_credit_card,
        auth_code: this.auth_code_credit_card,
        installments: this.installments,
      },
      metadata: {
        referer_url: this.referer_url,
        checkout_url: this.checkout_url,
      },
      dates: {
        approved_at: this.approved_at,
        refunded_at: this.refunded_at,
        refused_at: this.refused_at,
        chargedback_at: this.chargedback_at,
        refunded_processing_at: this.refunded_processing_at,
        disputed_at: this.disputed_at,
        expired_at: this.expired_at,
        failed_at: this.failed_at,
        available_anticipation_at: this.available_anticipation_at,
        anticipated_at: this.anticipated_at,
      },
      created_at: this.created_at,
    };
  }
}
