// wallets/repositories/wallet.repository.ts
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  transaction_account_type,
  transaction_currency,
} from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.walletCreateInput) {
    return this.prisma.wallet.create({
      data,
    });
  }

  async findByCompanyId(companyId: string) {
    return this.prisma.wallet.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: 'desc' },
    });
  }

  async findByCompanyIdAndCurrency(
    companyId: string,
    currency: transaction_currency,
  ) {
    return this.prisma.wallet.findMany({
      where: {
        company_id: companyId,
        currency: currency,
      },
    });
  }

  async findByCompanyIdAndAccountType(
    companyId: string,
    accountType: transaction_account_type,
  ) {
    return this.prisma.wallet.findMany({
      where: {
        company_id: companyId,
        account_type: accountType,
      },
    });
  }

  async findOne(
    companyId: string,
    accountType: transaction_account_type,
    currency: transaction_currency,
  ) {
    return this.prisma.wallet.findFirst({
      where: {
        company_id: companyId,
        account_type: accountType,
        currency: currency,
      },
    });
  }
}
