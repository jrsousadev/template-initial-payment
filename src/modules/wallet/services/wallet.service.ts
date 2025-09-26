import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletRepository } from '../repositories/wallet.repository';
import { transaction_account_type, transaction_currency } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(private readonly walletRepository: WalletRepository) {}

  async getWalletsByAccountType(
    companyId: string,
    accountType: transaction_account_type,
  ) {
    const wallets = await this.walletRepository.findByCompanyIdAndAccountType(
      companyId,
      accountType,
    );

    if (!wallets || wallets.length === 0) {
      throw new NotFoundException(
        `No wallets found for account type ${accountType}`,
      );
    }

    return wallets;
  }

  async createWallet(companyId: string) {
    const accountTypes: transaction_account_type[] = [
      'BALANCE_AVAILABLE',
      'BALANCE_PENDING',
      'BALANCE_RESERVE',
    ];

    const currencyTypes: transaction_currency[] = ['BRL', 'USD', 'MXN'];

    for (const accountType of accountTypes) {
      await this.walletRepository.create({
        company: { connect: { id: companyId } },
        account_type: accountType,
        currency: currencyTypes[0],
        balance: 0,
        last_entry_id: null,
        last_updated: new Date(),
        version: 1,
      });
    }
  }
}
