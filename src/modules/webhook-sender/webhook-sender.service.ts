import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable, Logger } from '@nestjs/common';
import { infraction_status } from '@prisma/client';
import { SqsService } from '@ssut/nestjs-sqs';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import {
  CreateWebhookLogsParamsData,
  IBuildWebhookInfractionsPayloadParams,
  IBuildWebhookPaymentsPayloadParams,
  IBuildWebhookWithdrawalsPayloadParams,
  IWebhookBuilded,
  IWebhooksWithIds,
} from './webhook-sender.interfaces';

@Injectable()
export class WebhookSenderService {
  private readonly logger = new Logger(WebhookSenderService.name);
  private sqsClient: SQSClient;
  private queueUrl: string;

  private readonly MAX_BATCH_SIZE = 10;
  private readonly MAX_PARALLEL_BATCHES = 20;

  constructor(
    private readonly cacheService: CacheService,
    private readonly sqsService: SqsService,
    private readonly prisma: PrismaService,
  ) {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION as string,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      },
    });
    this.queueUrl = process.env.SQS_QUEUE_URL as string;
  }

  private buildWebhookPaymentsPayload(
    params: IBuildWebhookPaymentsPayloadParams,
  ) {
    const { payment } = params;

    const base = {
      payment_id: payment.id,
      external_id: payment.external_id,
      end_to_end_id: payment.end_to_end_id,
      amount: payment.amount,
      customer: {
        email: payment.customer_email,
        name: payment.customer_name,
        phone: payment.customer_phone,
        document: {
          number: payment.customer_document,
        },
      },
    };

    switch (payment.status) {
      case 'APPROVED':
        return {
          event: 'payment.approved',
          data: {
            ...base,
            status: 'APPROVED',
          },
        };
      case 'REFUNDED':
        return {
          event: 'payment.refunded',
          data: {
            ...base,
            status: 'REFUNDED',
          },
        };
      default:
        return {};
    }
  }

  private buildWebhookWithdrawalsPayload(
    params: IBuildWebhookWithdrawalsPayloadParams,
  ) {
    const { withdrawal } = params;

    const base = {
      withdrawal_id: withdrawal.id,
      external_id: withdrawal.external_id,
      end_to_end_id: withdrawal.end_to_end_id,
      amount: withdrawal.amount,
    };

    switch (withdrawal.status) {
      case 'APPROVED':
        return {
          event: 'withdrawal.approved',
          data: {
            ...base,
            status: 'APPROVED',
          },
        };
      case 'REFUNDED':
        return {
          event: 'withdrawal.refunded',
          data: {
            ...base,
            status: 'REFUNDED',
          },
        };
      case 'FAILED':
        return {
          event: 'withdrawal.failed',
          data: {
            ...base,
            status: 'FAILED',
          },
        };
      default:
        return {};
    }
  }

  private buildWebhookInfractionsPayload(
    params: IBuildWebhookInfractionsPayloadParams,
  ) {
    const { infraction } = params;

    const base = {
      id: infraction.id,
      reason: infraction.reason,
      payment_id: infraction.payment_id,
      created_at: infraction.created_at,
      analysis_result: infraction.analysis_result,
      analysis_reason: infraction.analysis_reason,
      closed_at: infraction.closed_at,
      defended_at: infraction.defended_at,
      cancelled_at: infraction.cancelled_at,
      responsed_at: infraction.responsed_at,
    };

    switch (infraction.status) {
      case 'AWAITING_COMPANY_RESPONSE':
        return {
          event: 'infraction.awaiting_company_response',
          data: {
            ...base,
            status: 'AWAITING_COMPANY_RESPONSE' as infraction_status,
          },
        };
      case 'UNDER_REVIEW':
        return {
          event: 'infraction.under_review',
          data: {
            ...base,
            status: 'UNDER_REVIEW' as infraction_status,
          },
        };
      case 'CANCELLED':
        return {
          event: 'infraction.cancelled',
          data: {
            ...base,
            status: 'CANCELLED' as infraction_status,
          },
        };
      case 'CLOSED':
        return {
          event: 'infraction.closed',
          data: {
            ...base,
            status: 'CLOSED' as infraction_status,
          },
        };

      default:
        return {};
    }
  }

  async createWebhooksLog(webhooks: CreateWebhookLogsParamsData[]) {
    try {
      const webhooksWithIds: IWebhooksWithIds[] = [];

      webhooks.forEach((w) => {
        if (w.type === 'PAYMENT' || w.type === 'REFUND_IN') {
          if (!w.payment) {
            throw new Error('Payment data is required for PAYMENT webhook');
          }

          webhooksWithIds.push({
            id: UniqueIDGenerator.generate(),
            company_id: w.payment.company_id,
            webhook_id: w.webhook.id,
            payment_id: w.payment.id,
            type: w.webhook.type,
            url: w.webhook.url,
            payload: this.buildWebhookPaymentsPayload({ payment: w.payment }),
          });
        }

        if (w.type === 'INFRACTION') {
          if (!w.infraction) {
            throw new Error(
              'Infraction data is required for INFRACTION webhook',
            );
          }

          webhooksWithIds.push({
            id: UniqueIDGenerator.generate(),
            company_id: w.infraction.company_id,
            webhook_id: w.webhook.id,
            infraction_id: w.infraction.id,
            type: w.webhook.type,
            url: w.webhook.url,
            payload: this.buildWebhookInfractionsPayload({
              infraction: w.infraction,
            }),
          });
        }

        if (w.type === 'WITHDRAWAL' || w.type === 'REFUND_OUT') {
          if (!w.withdrawal) {
            throw new Error(
              'Withdrawal data is required for WITHDRAWAL webhook',
            );
          }

          webhooksWithIds.push({
            id: UniqueIDGenerator.generate(),
            company_id: w.withdrawal.company_id,
            webhook_id: w.webhook.id,
            withdrawal_id: w.withdrawal.id,
            type: w.webhook.type,
            url: w.webhook.url,
            payload: this.buildWebhookWithdrawalsPayload({
              withdrawal: w.withdrawal,
            }),
          });
        }
      });

      await Promise.all([
        (async () => {
          let currentQueue =
            await this.cacheService.get<string[]>('webhook:queue');

          if (!Array.isArray(currentQueue)) {
            currentQueue = [];
          }

          const updatedQueue = [
            ...currentQueue,
            ...webhooksWithIds.map((w) => JSON.stringify(w)),
          ];

          await this.cacheService.set('webhook:queue', updatedQueue, 3600000);
        })(),

        this.prisma.webhook_log.createMany({
          data: webhooksWithIds as any,
          skipDuplicates: true,
        }),
      ]);
    } catch (error) {
      this.logger.error('Error creating webhooks log:', error);
      throw error;
    }
  }

  async sendWebhooksFromSQS(webhooks: IWebhookBuilded[]) {
    try {
      const webhooksByCompany = new Map<string, IWebhookBuilded[]>();

      for (const w of webhooks) {
        const companyId = w.company_id;
        if (!webhooksByCompany.has(companyId)) {
          webhooksByCompany.set(companyId, []);
        }
        webhooksByCompany.get(companyId)!.push(w);
      }

      const messages = await this.prepareMessagesOptimized(webhooksByCompany);

      const batches = this.chunkArray(messages, this.MAX_BATCH_SIZE);

      for (let i = 0; i < batches.length; i += this.MAX_PARALLEL_BATCHES) {
        const batchGroup = batches.slice(i, i + this.MAX_PARALLEL_BATCHES);
        await Promise.all(
          batchGroup.map((batch) => this.sendBatchOptimized(batch)),
        );
      }

      this.logger.log(
        `Total de ${webhooks.length} webhooks enviados em ${batches.length} batches`,
      );
    } catch (error) {
      this.logger.error('Error sending webhooks from SQS:', error);
      throw error;
    }
  }

  private async prepareMessagesOptimized(
    webhooksByCompany: Map<string, IWebhookBuilded[]>,
  ): Promise<any[]> {
    const allMessages: any[] = [];

    for (const [companyId, companyWebhooks] of webhooksByCompany) {
      const messages = companyWebhooks.map((w) => {
        return {
          id: UniqueIDGenerator.generate(),
          body: {
            id: w.id,
            url: w.url,
            payload: w.payload,
            saveToDb: {
              url: w.url,
              type: w.type,
              companyId: w.company_id,
              paymentId: w.payment_id,
            },
          },
          delaySeconds: 0,
        };
      });

      allMessages.push(...messages);
    }

    return allMessages;
  }

  private async sendBatchOptimized(messages: any[]): Promise<void> {
    try {
      const command = new SendMessageBatchCommand({
        QueueUrl: this.queueUrl,
        Entries: messages.map((msg, index) => ({
          Id: String(index),
          MessageBody: JSON.stringify(msg.body),
          DelaySeconds: msg.delaySeconds || 0,
        })),
      });

      const response = await this.sqsClient.send(command);

      if (response.Failed && response.Failed.length > 0) {
        this.logger.error('Messages failed:', response.Failed);

        // Retry individual messages for failed ones
        for (const failed of response.Failed) {
          const originalMessage = messages[parseInt(failed.Id || '0', 10)];
          await this.sqsService.send('webhook-queue', originalMessage.body);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error sending batch with ${messages.length} messages:`,
        error,
      );
      throw error;
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
