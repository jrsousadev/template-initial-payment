import { Module } from '@nestjs/common';
import { PaymentReleaseScheduleService } from './services/payment-release-schedule.service';
import { PaymentReleaseScheduleRepository } from './repositories/payment-release-schedule.repository';

@Module({
  providers: [PaymentReleaseScheduleService, PaymentReleaseScheduleRepository],
  exports: [PaymentReleaseScheduleService],
})
export class PaymentReleaseScheduleModule {}
