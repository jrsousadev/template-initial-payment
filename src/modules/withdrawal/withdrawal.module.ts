import { Module } from '@nestjs/common';
import { WithdrawalService } from './services/withdrawal.service';
import { WithdrawalController } from './controllers/withdrawal.controller';
import { WithdrawalRepository } from './repositories/withdrawal.repository';
import { ReceiverModule } from '../receiver/receiver.module';
import { CompanyModule } from '../company/company.module';
import { WithdrawalValidatorService } from './services/withdrawal-validator.service';
import { WithdrawalFeeCalculatorService } from './services/withdrawal-fee-calculator.service';
import { InfractionModule } from '../infraction/infraction.module';

@Module({
  imports: [ReceiverModule, CompanyModule, InfractionModule],
  controllers: [WithdrawalController],
  providers: [
    WithdrawalService,
    WithdrawalRepository,
    WithdrawalValidatorService,
    WithdrawalFeeCalculatorService,
  ],
})
export class WithdrawalModule {}
