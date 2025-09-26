import { Module } from '@nestjs/common';
import { WebhookService } from './services/webhook.service';
import { WebhookRepository } from './repositories/webhook.repository';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { WebhookController } from './controllers/webhook.controller';

@Module({
  imports: [],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookRepository, PrismaService],
  exports: [WebhookService],
})
export class WebhookModule {}
