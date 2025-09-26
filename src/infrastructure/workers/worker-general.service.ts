import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { snowflakeMid } from 'src/common/utils/snowflake-mid.util';
import { IWebhooksWithIds } from 'src/modules/webhook-sender/webhook-sender.interfaces';
import { WebhookSenderService } from 'src/modules/webhook-sender/webhook-sender.service';
import { CacheService } from '../cache/cache.service';
import { GeneralProcessorQueue } from '../queue/services/general-processor.queue';

@Injectable()
export class WorkerGeneralService implements OnModuleInit {
  private logger = new Logger(WorkerGeneralService.name);
  private intervals: NodeJS.Timeout[] = [];

  private readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  private readonly isWorkerGeneral = process.env.IS_WORKER_GENERAL ?? 'false';
  private readonly workerId = snowflakeMid;

  private activeProcessTask = 0;
  private maxActiveProcessTask = 1;

  private isProcessingWebhooks = false;
  private webhookParseCache = new Map<string, any>();
  private readonly WEBHOOK_BATCH_SIZE = 500;
  private readonly PARSE_CACHE_SIZE = 5000;

  constructor(
    private readonly cacheService: CacheService,
    private readonly generalProcessorQueue: GeneralProcessorQueue,
    private readonly webhookSenderService: WebhookSenderService,
  ) {}

  onModuleInit() {
    if (this.nodeEnv !== 'production' && this.nodeEnv !== 'staging') {
      this.logger.warn(
        'WorkerGeneralService is not enabled in this environment',
      );
      return;
    }

    if (this.isWorkerGeneral === 'true') {
      const startDelay = Math.random() * 3000;

      setTimeout(() => {
        this.intervals.push(
          setInterval(() => this.processGeneralTasks(), 1500),
        );
        this.logger.log(
          `Worker ${this.workerId}: started with ${startDelay}ms delay`,
        );
      }, startDelay);
    }
  }

  async processGeneralTasks() {
    if (this.activeProcessTask >= this.maxActiveProcessTask) return;

    this.activeProcessTask++;

    try {
      await this.generalProcessorQueue.loadPendingTasks({
        batchSize: 350,
      });
    } catch (error) {
      this.logger.error('Error processing general tasks:', error);
    } finally {
      this.activeProcessTask--;
    }
  }

  async processWebhooks() {
    if (this.isProcessingWebhooks) return;

    const lockKey = `webhook:processing:${this.workerId}`;
    const lockDuration = 5000;

    try {
      await this.cacheService.set(lockKey, Date.now(), lockDuration);
      this.isProcessingWebhooks = true;

      const startTime = Date.now();

      const batchKey = `webhook:batch:${this.workerId}:${Date.now()}`;

      const queue =
        (await this.cacheService.get<string[]>('webhook:queue')) || [];

      if (queue.length === 0) return;

      const batchSize = Math.min(this.WEBHOOK_BATCH_SIZE, queue.length);
      const webhooksToProcess = queue.slice(0, batchSize);
      const remainingQueue = queue.slice(batchSize);

      if (remainingQueue.length > 0) {
        await this.cacheService.set('webhook:queue', remainingQueue, 3600000);
      } else {
        await this.cacheService.del('webhook:queue');
      }

      await this.cacheService.set(batchKey, webhooksToProcess, 60000);

      const webhooks: any[] = [];
      const parseErrors: string[] = [];

      for (const webhookStr of webhooksToProcess) {
        try {
          let webhook = this.webhookParseCache.get(webhookStr);
          if (!webhook) {
            webhook = JSON.parse(webhookStr);
            if (this.webhookParseCache.size < this.PARSE_CACHE_SIZE) {
              this.webhookParseCache.set(webhookStr, webhook);
            }
          }
          webhooks.push(webhook);
        } catch (error) {
          parseErrors.push(webhookStr);
          this.logger.error(`Worker ${this.workerId} parse error:`, error);
        }
      }

      if (parseErrors.length > 0) {
        const currentQueue =
          (await this.cacheService.get<string[]>('webhook:queue')) || [];
        await this.cacheService.set(
          'webhook:queue',
          [...currentQueue, ...parseErrors],
          3600000,
        );
      }

      if (webhooks.length > 0) {
        // Processar em chunks menores
        const chunkSize = 100;
        const chunks = this.chunkArray(webhooks, chunkSize);

        for (const chunk of chunks) {
          try {
            await this.webhookSenderService.sendWebhooksFromSQS(
              chunk.map((w: IWebhooksWithIds) => ({
                id: w.id,
                company_id: w.company_id,
                webhook_id: w.webhook_id,
                payment_id: w.payment_id,
                withdrawal_id: w.withdrawal_id,
                payload: w.payload,
                url: w.url,
                type: w.type,
              })),
            );
          } catch (error) {
            this.logger.error(`Worker ${this.workerId} SQS error:`, error);

            // Re-adicionar chunk falho
            const failedWebhooks = chunk.map((w) => JSON.stringify(w));
            const currentQueue =
              (await this.cacheService.get<string[]>('webhook:queue')) || [];
            await this.cacheService.set(
              'webhook:queue',
              [...currentQueue, ...failedWebhooks],
              3600000,
            );
          }
        }
      }

      await this.cacheService.del(batchKey);

      const elapsed = Date.now() - startTime;
      if (webhooks.length > 0) {
        this.logger.log(
          `Worker ${this.workerId}: Processed ${webhooks.length} webhooks in ${elapsed}ms`,
        );
      }

      // Limpar cache se necessário
      if (this.webhookParseCache.size > this.PARSE_CACHE_SIZE * 0.8) {
        this.webhookParseCache.clear();
      }
    } catch (error) {
    } finally {
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
