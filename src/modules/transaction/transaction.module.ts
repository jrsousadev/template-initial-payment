import { Module } from '@nestjs/common';
import { TransactionService } from './services/transaction.service';
import { TransactionRepository } from './repositories/transaction.repository';

@Module({
  providers: [TransactionService, TransactionRepository],
  exports: [TransactionService],
})
export class TransactionModule {}
