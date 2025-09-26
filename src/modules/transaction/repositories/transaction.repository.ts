import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionRepository {
  async createMany(
    data: Prisma.transactionCreateManyInput[],
    tx: Prisma.TransactionClient,
  ) {
    if (data.length === 0) {
      return { count: 0 };
    }

    return tx.transaction.createMany({
      data,
      skipDuplicates: true,
    });
  }
}
