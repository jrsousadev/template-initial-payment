import { Global, Module } from '@nestjs/common';
import { AwsModule } from 'src/infrastructure/aws/aws.module';
import { WebhookSenderService } from './webhook-sender.service';

@Global()
@Module({
  imports: [AwsModule],
  exports: [WebhookSenderService],
  providers: [WebhookSenderService],
})
export class WebhookSenderModule {}
