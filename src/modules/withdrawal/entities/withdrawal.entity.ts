import {
  $Enums,
  withdrawal as PrismaWithdrawal,
  provider_name,
  receiver,
} from '@prisma/client';
import { IWithdrawalResponse } from '../interfaces/withdrawal.interfaces';

export class Withdrawal implements PrismaWithdrawal {
  id: string;
  provider_withdrawal_id: string | null;
  end_to_end_id: string | null;
  external_id: string | null;
  status: $Enums.withdrawal_status;
  withdrawal_type: $Enums.withdrawal_type;

  // Dados do destinatário

  bank_code: string | null;
  bank_name: string | null;
  bank_branch_code: string | null;
  bank_branch_check_digit: string | null;
  bank_account_number: string | null;
  bank_account_check_digit: string | null;
  bank_account_type: $Enums.receiver_bank_account_type | null;
  pix_key: string | null;
  pix_key_type: string | null;
  creditor_name: string | null;
  creditor_document: string | null;
  wallet_network: string | null;
  wallet_address: string | null;

  // Valores
  total_amount: number;
  amount: number;
  amount_fee: number;
  amount_organization: number;
  amount_provider: number;

  // Metadados
  referer_url: string | null;
  ip: string | null;
  user_agent: string | null;
  provider_name: provider_name;

  // Monitoramento
  error_message: string | null;
  error_provider_response: any;
  create_provider_response: any;

  // Taxas
  tax_rate: number;
  tax_fee: number;
  tax_rate_provider: number;
  tax_fee_provider: number;

  // Relacionamentos IDs
  user_id: string | null;
  api_key_id: string | null;
  company_id: string;
  provider_id: string;
  receiver_id: string | null;
  devolutionId: string | null;
  receiver: receiver;

  // monitoramento de processamento lock
  balance_deducted: boolean;
  processing_attempts: number;
  last_processing_attempt_at: Date | null;
  processing_worker_id: string | null;

  // Timestamps
  approved_at: Date | null;
  refused_at: Date | null;
  processing_at: Date | null;
  refunded_at: Date | null;
  failed_at: Date | null;
  error_system_at: Date | null;
  created_at: Date;
  updated_at: Date;

  constructor(data: PrismaWithdrawal) {
    this.validate(data);
    Object.assign(this, data);
  }

  private validate(data: PrismaWithdrawal): void {
    if (data.amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero');
    }

    if (data.amount_fee < 0) {
      throw new Error('Fee amounts cannot be negative');
    }

    if (!data.receiver_id) {
      throw new Error('Receiver ID is required for withdrawal');
    }
  }

  isPending(): boolean {
    return this.status === 'PENDING';
  }

  isApproved(): boolean {
    return this.status === 'APPROVED';
  }

  isProcessing(): boolean {
    return this.status === 'PROCESSING';
  }

  canRefund(): boolean {
    return this.status === 'APPROVED' && !this.refunded_at;
  }

  canApprove(): boolean {
    return this.status === 'PROCESSING' && !this.approved_at;
  }

  canFail(): boolean {
    return this.status === 'PROCESSING' && !this.failed_at;
  }

  toJSON(): IWithdrawalResponse {
    return {
      id: this.id,
      external_id: this.external_id,
      end_to_end_id: this.end_to_end_id,
      status: this.status,
      type: this.withdrawal_type,
      amount: this.amount,
      total_amount: this.total_amount,
      fees: {
        amount_fee: this.amount_fee,
        tax_rate: this.tax_rate,
        tax_fee: this.tax_fee,
      },
      receiver: {
        id: this.receiver_id,
        type: this.withdrawal_type,
        pix_key: this.receiver ? this.receiver.pix_key : null,
        bank_account: this.receiver ? this.receiver.bank_account_number : null,
        wallet_address: this.receiver ? this.receiver.wallet_id : null,
      },
      dates: {
        approved_at: this.approved_at,
        processing_at: this.processing_at,
        refunded_at: this.refunded_at,
        failed_at: this.failed_at,
        refused_at: this.refused_at,
      },
      created_at: this.created_at,
    };
  }
}
