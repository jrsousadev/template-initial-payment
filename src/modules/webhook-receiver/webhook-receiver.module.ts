import { Module } from '@nestjs/common';
import { WebhookReceiverController } from './webhook-receiver.controller';

@Module({
  controllers: [WebhookReceiverController],
  providers: [],
})
export class WebhookReceiverModule {}
