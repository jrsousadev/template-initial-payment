import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { PaymentModule } from '../payment/payment.module';
import { TransactionModule } from '../transaction/transaction.module';
import { WalletModule } from '../wallet/wallet.module';
import { AnticipationController } from './controllers/anticipation.controller';
import { AnticipationRepository } from './repositories/anticipation.repository';
import { AnticipationService } from './services/anticipation.service';

@Module({
  imports: [PaymentModule, WalletModule, CompanyModule, TransactionModule],
  controllers: [AnticipationController],
  providers: [AnticipationService, AnticipationRepository],
  exports: [AnticipationService],
})
export class AnticipationModule {}
