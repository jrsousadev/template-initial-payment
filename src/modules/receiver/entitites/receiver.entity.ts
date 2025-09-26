import {
  receiver as PrismaReceiver,
  receiver_status,
  receiver_type,
  receiver_bank_account_type,
  receiver_bank_holder_type,
  receiver_pix_type,
  receiver_crypto_network,
  provider,
} from '@prisma/client';

export class Receiver implements PrismaReceiver {
  id: string;
  status: receiver_status;
  type: receiver_type;

  // Bank fields
  bank_holder_name: string | null;
  bank_holder_type: receiver_bank_holder_type | null;
  bank_holder_document: string | null;
  bank_code: string | null;
  bank_name: string | null;
  bank_branch_code: string | null;
  bank_branch_check_digit: string | null;
  bank_account_number: string | null;
  bank_account_check_digit: string | null;
  bank_account_type: receiver_bank_account_type | null;

  // PIX fields
  pix_key: string | null;
  pix_type: receiver_pix_type | null;

  // Wallet fields
  wallet_network: receiver_crypto_network | null;
  wallet_id: string | null;

  // Relations
  company_id: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;

  constructor(data: PrismaReceiver) {
    this.validate(data);
    Object.assign(this, data);
  }

  private validate(data: PrismaReceiver): void {
    if (data.type === 'BANK_ACCOUNT') {
      if (!data.bank_holder_name || !data.bank_holder_document) {
        throw new Error(
          'Bank holder information is required for bank accounts',
        );
      }
      if (!data.bank_code || !data.bank_account_number) {
        throw new Error('Bank account details are required');
      }
    }

    if (data.type === 'CRIPTO_WALLET') {
      if (!data.wallet_id || !data.wallet_network) {
        throw new Error(
          'Wallet address and network are required for crypto wallets',
        );
      }
    }
  }

  isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  isPending(): boolean {
    return this.status === 'PENDING';
  }

  isRejected(): boolean {
    return this.status === 'REJECTED';
  }

  canBeUsed(): boolean {
    return this.isActive() && !this.deleted_at;
  }

  maskSensitiveData(): Partial<Receiver> {
    const masked = { ...this };

    // Mascara documento
    if (masked.bank_holder_document) {
      const doc = masked.bank_holder_document;
      masked.bank_holder_document =
        doc.length === 11
          ? `***.***.***-${doc.slice(-2)}`
          : `**.***.***/**-${doc.slice(-2)}`;
    }

    // Mascara conta bancária
    if (masked.bank_account_number) {
      const acc = masked.bank_account_number;
      masked.bank_account_number = `****${acc.slice(-4)}`;
    }

    // Mascara wallet
    if (masked.wallet_id) {
      const wallet = masked.wallet_id;
      masked.wallet_id = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
    }

    return masked;
  }

  validateForWithdrawal(
    type: 'PIX' | 'BANK_ACCOUNT' | 'CRIPTO_WALLET',
    provider: provider,
  ): void {
    if (!this.isActive()) {
      throw new Error('Receiver is not active');
    }

    if (type === 'PIX' && !this.pix_key) {
      throw new Error('Receiver does not have PIX configured');
    }

    if (type === 'BANK_ACCOUNT' && this.type !== 'BANK_ACCOUNT') {
      throw new Error('Receiver is not a bank account');
    }

    if (type === 'CRIPTO_WALLET' && this.type !== 'CRIPTO_WALLET') {
      throw new Error('Receiver is not a crypto wallet');
    }
  }
}
