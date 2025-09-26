import { Global, Module } from '@nestjs/common';
import { WorkerGeneralService } from './worker-general.service';
import { WorkerCallProviderWithdrawalAndWallet } from './worker-call-provider-withdrawal-and-wallet.service';
import { PaymentReleaseScheduleModule } from 'src/modules/payment-release-schedule/payment-release-schedule.module';

@Global()
@Module({
  imports: [PaymentReleaseScheduleModule],
  providers: [WorkerGeneralService, WorkerCallProviderWithdrawalAndWallet],
  exports: [WorkerGeneralService, WorkerCallProviderWithdrawalAndWallet],
})
export class WorkerModule {}
