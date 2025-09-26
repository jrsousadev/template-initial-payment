import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { WebhookRepository } from '../repositories/webhook.repository';
import { Webhook } from '../entities/webhook.entity';
import { WebhookLog } from '../entities/webhook-log.entity';
import { WebhookStats } from '../interfaces/webhook.interfaces';
import {
  CreateWebhookDto,
  WebhookFiltersDto,
  UpdateWebhookDto,
  CreateWebhookLogDto,
  WebhookLogFiltersDto,
} from '../dto/webhook.dto';

@Injectable()
export class WebhookService {
  constructor(private readonly repository: WebhookRepository) {}

  // ===== WEBHOOK OPERATIONS =====

  async create(dto: CreateWebhookDto) {
    // Verificar se já existe webhook do mesmo tipo para a empresa
    const existing = await this.repository.findByCompanyAndType(
      dto.companyId,
      dto.type,
    );

    if (existing.length > 0) {
      throw new ConflictException(
        `Webhook of type ${dto.type} already exists for this company`,
      );
    }

    const webhook = await this.repository.create({
      type: dto.type,
      url: dto.url,
      company: { connect: { id: dto.companyId } },
    });

    return new Webhook(webhook);
  }

  async findAll(filters?: WebhookFiltersDto) {
    const webhooks = await this.repository.findAll(filters);
    return webhooks.map((w) => new Webhook(w));
  }

  async findOne(id: string) {
    const webhook = await this.repository.findById(id);

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }

    return new Webhook(webhook);
  }

  async findByCompanyAndType(companyId: string, type: string) {
    const webhooks = await this.repository.findByCompanyAndType(
      companyId,
      type,
    );
    return webhooks.map((w) => new Webhook(w));
  }

  async update(id: string, dto: UpdateWebhookDto) {
    const webhook = await this.repository.findById(id);

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }

    // Se está mudando o tipo, verificar se não existe outro
    if (dto.type && dto.type !== webhook.type) {
      const existing = await this.repository.findByCompanyAndType(
        webhook.company_id,
        dto.type,
      );

      if (existing.length > 0) {
        throw new ConflictException(
          `Webhook of type ${dto.type} already exists for this company`,
        );
      }
    }

    const updated = await this.repository.update(id, {
      ...(dto.type && { type: dto.type }),
      ...(dto.url && { url: dto.url }),
    });

    return new Webhook(updated);
  }

  async remove(id: string) {
    const webhook = await this.repository.findById(id);

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }

    // Soft delete também os logs associados
    const logs = await this.repository.findAllLogs({ webhookId: id });
    for (const log of logs) {
      await this.repository.deleteLog(log.id);
    }

    await this.repository.delete(id);
  }

  async restore(id: string) {
    const webhook = await this.repository.findById(id, true);

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }

    if (!webhook.deleted_at) {
      throw new BadRequestException('Webhook is not deleted');
    }

    const restored = await this.repository.restore(id);
    return new Webhook(restored);
  }

  // ===== WEBHOOK LOG OPERATIONS =====

  async createLog(dto: CreateWebhookLogDto) {
    // Verificar se o webhook existe e está ativo
    const webhook = await this.repository.findById(dto.webhookId);

    if (!webhook) {
      throw new NotFoundException(`Webhook ${dto.webhookId} not found`);
    }

    const log = await this.repository.createLog({
      type: dto.type,
      status: dto.status || 'PENDING',
      url: webhook.url,
      payload: dto.payload,
      retry_limit: dto.retryLimit || 3,
      retry_delay: dto.retryDelay || 5000,
      webhook: { connect: { id: dto.webhookId } },
      company: { connect: { id: dto.companyId } },
      ...(dto.paymentId && {
        payment: { connect: { id: dto.paymentId } },
      }),
      ...(dto.withdrawalId && {
        withdrawal: { connect: { id: dto.withdrawalId } },
      }),
    });

    return new WebhookLog(log);
  }

  async findAllLogs(filters?: WebhookLogFiltersDto) {
    const logs = await this.repository.findAllLogs(filters);
    return logs.map((l) => new WebhookLog(l));
  }

  async findLogById(id: string) {
    const log = await this.repository.findLogById(id);

    if (!log) {
      throw new NotFoundException(`Webhook log ${id} not found`);
    }

    return new WebhookLog(log);
  }

  async deleteLog(id: string) {
    const log = await this.repository.findLogById(id);

    if (!log) {
      throw new NotFoundException(`Webhook log ${id} not found`);
    }

    await this.repository.deleteLog(id);
  }

  async restoreLog(id: string) {
    const log = await this.repository.findLogById(id, true);

    if (!log) {
      throw new NotFoundException(`Webhook log ${id} not found`);
    }

    if (!log.deleted_at) {
      throw new BadRequestException('Log is not deleted');
    }

    const restored = await this.repository.restoreLog(id);
    return new WebhookLog(restored);
  }

  // ===== RETRY OPERATIONS =====

  async processRetries() {
    const pendingRetries = await this.repository.findPendingRetries();

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
    };

    for (const log of pendingRetries) {
      const logEntity = new WebhookLog(log);

      if (logEntity.shouldRetryNow()) {
        results.processed++;

        try {
          // Aqui você implementaria a lógica de retry
          // Por enquanto, apenas marcamos como processado
          logEntity.incrementRetry();

          await this.repository.updateLog(log.id, {
            status: logEntity.status,
            retry_count: logEntity.retry_count,
            retry_at: logEntity.retry_at,
          });

          results.successful++;
        } catch (error) {
          results.failed++;
        }
      }
    }

    return results;
  }

  // ===== STATS & HELPERS =====

  async getWebhookStats(webhookId: string): Promise<WebhookStats> {
    const webhook = await this.repository.findById(webhookId);

    if (!webhook) {
      throw new NotFoundException(`Webhook ${webhookId} not found`);
    }

    const stats = await this.repository.getWebhookStats(webhookId);

    const result: WebhookStats = {
      totalSent: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      retrying: 0,
      successRate: 0,
    };

    for (const stat of stats) {
      const count = stat._count;
      result.totalSent += count;

      switch (stat.status) {
        case 'COMPLETED':
          result.successful = count;
          break;
        case 'FAILED':
          result.failed = count;
          break;
        case 'PENDING':
          result.pending = count;
          break;
        case 'RETRYING':
          result.retrying = count;
          break;
      }
    }

    if (result.totalSent > 0) {
      result.successRate = (result.successful / result.totalSent) * 100;
    }

    return result;
  }

  async getCompanyStats(companyId: string) {
    const stats = await this.repository.getCompanyStats(companyId);

    const result = {
      byType: {} as Record<string, any>,
      total: {
        sent: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        retrying: 0,
      },
    };

    for (const stat of stats) {
      const count = stat._count;
      const type = stat.type;
      const status = stat.status;

      if (!result.byType[type]) {
        result.byType[type] = {
          sent: 0,
          successful: 0,
          failed: 0,
          pending: 0,
          retrying: 0,
        };
      }

      result.byType[type].sent += count;
      result.total.sent += count;

      switch (status) {
        case 'COMPLETED':
          result.byType[type].successful += count;
          result.total.successful += count;
          break;
        case 'FAILED':
          result.byType[type].failed += count;
          result.total.failed += count;
          break;
        case 'PENDING':
          result.byType[type].pending += count;
          result.total.pending += count;
          break;
        case 'RETRYING':
          result.byType[type].retrying += count;
          result.total.retrying += count;
          break;
      }
    }

    return result;
  }

  async cleanOldLogs(daysToKeep: number = 30): Promise<number> {
    return this.repository.cleanOldLogs(daysToKeep);
  }
}
