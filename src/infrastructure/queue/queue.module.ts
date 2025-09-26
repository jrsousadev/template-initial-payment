import { Global, Module } from '@nestjs/common';
import { GeneralProcessorQueue } from './services/general-processor.queue';
import { PaymentApprovedHandlerQueue } from './handlers/payment-approved.handler';
import { TransactionModule } from 'src/modules/transaction/transaction.module';
import { PaymentRefundedHandlerQueue } from './handlers/payment-refunded.handler';
import { CallProviderWithdrawalProcessorQueue } from './services/call-provider-withdrawal-processor.queue';
import { WithdrawalRefundedHandlerQueue } from './handlers/withdrawal-refunded.handler';
import { InfractionModule } from 'src/modules/infraction/infraction.module';
import { PaymentModule } from 'src/modules/payment/payment.module';
import { PaymentReleaseScheduleModule } from 'src/modules/payment-release-schedule/payment-release-schedule.module';

@Global()
@Module({
  imports: [
    TransactionModule,
    InfractionModule,
    PaymentModule,
    PaymentReleaseScheduleModule,
  ],
  providers: [
    GeneralProcessorQueue,
    CallProviderWithdrawalProcessorQueue,
    PaymentApprovedHandlerQueue,
    PaymentRefundedHandlerQueue,
    WithdrawalRefundedHandlerQueue,
  ],
  exports: [
    GeneralProcessorQueue,
    CallProviderWithdrawalProcessorQueue,
    PaymentApprovedHandlerQueue,
    PaymentRefundedHandlerQueue,
    WithdrawalRefundedHandlerQueue,
  ],
})
export class QueueModule {}
