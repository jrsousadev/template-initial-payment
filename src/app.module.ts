import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { HealthController } from './health.controller';
import { AwsModule } from './infrastructure/aws/aws.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { EmailModule } from './infrastructure/email/email.module';
import { GatewayModule } from './infrastructure/gateways/gateway.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { WorkerModule } from './infrastructure/workers/worker.module';
import { AnticipationModule } from './modules/anticipation/anticipation.module';
import { ApiKeysModule } from './modules/api-key/api-key.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { CurrencyConversionModule } from './modules/currency-conversion/currency-conversion.module';
import { CustomerModule } from './modules/customer/customer.module';
import { DevolutionModule } from './modules/devolution/devolution.module';
import { InfractionModule } from './modules/infraction/infraction.module';
import { LinkUserCompanyModule } from './modules/link-user-company/link-user-company.module';
import { PaymentItemModule } from './modules/payment-item/payment-item.module';
import { PaymentReleaseScheduleModule } from './modules/payment-release-schedule/payment-release-schedule.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ProviderModule } from './modules/provider/provider.module';
import { ReceiverModule } from './modules/receiver/receiver.module';
import { UserModule } from './modules/user/user.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { WebhookReceiverModule } from './modules/webhook-receiver/webhook-receiver.module';
import { WebhookSenderModule } from './modules/webhook-sender/webhook-sender.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { WithdrawalModule } from './modules/withdrawal/withdrawal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.ENV !== 'prod' ? 'silent' : 'info',
      },
    }),
    ScheduleModule.forRoot(),
    PaymentModule,
    DatabaseModule,
    UserModule,
    AwsModule,
    CompanyModule,
    WalletModule,
    ApiKeysModule,
    ProviderModule,
    GatewayModule,
    QueueModule,
    WebhookSenderModule,
    WebhookReceiverModule,
    WebhookModule,
    WorkerModule,
    ReceiverModule,
    DevolutionModule,
    WithdrawalModule,
    InfractionModule,
    CustomerModule,
    CacheModule,
    PaymentReleaseScheduleModule,
    PaymentItemModule,
    EmailModule,
    AnticipationModule,
    CurrencyConversionModule,
    LinkUserCompanyModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
