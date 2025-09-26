import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { Prisma, webhook, webhook_log } from '@prisma/client';
import { WebhookFiltersDto, WebhookLogFiltersDto } from '../dto/webhook.dto';

@Injectable()
export class WebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ===== WEBHOOK CRUD =====

  async create(data: Prisma.webhookCreateInput): Promise<webhook> {
    return this.prisma.webhook.create({ data });
  }

  async findAll(
    filters?: WebhookFiltersDto,
    includeDeleted: boolean = false,
  ): Promise<webhook[]> {
    const where: Prisma.webhookWhereInput = {};

    if (!includeDeleted) {
      where.deleted_at = null;
    }

    if (filters?.type) where.type = filters.type;
    if (filters?.companyId) where.company_id = filters.companyId;
    if (filters?.startDate || filters?.endDate) {
      where.created_at = {
        ...(filters.startDate && { gte: new Date(filters.startDate) }),
        ...(filters.endDate && { lte: new Date(filters.endDate) }),
      };
    }

    return this.prisma.webhook.findMany({
      where,
      include: {
        _count: {
          select: { webhooks_log: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findById(
    id: string,
    includeDeleted: boolean = false,
  ): Promise<webhook | null> {
    const where: Prisma.webhookWhereInput = { id };

    if (!includeDeleted) {
      where.deleted_at = null;
    }

    return this.prisma.webhook.findFirst({
      where,
      include: {
        webhooks_log: {
          where: { deleted_at: null },
          take: 10,
          orderBy: { created_at: 'desc' },
        },
      },
    });
  }

  async findByCompanyAndType(
    companyId: string,
    type: string,
    includeDeleted: boolean = false,
  ): Promise<webhook[]> {
    const where: Prisma.webhookWhereInput = {
      company_id: companyId,
      type: type as any,
    };

    if (!includeDeleted) {
      where.deleted_at = null;
    }

    return this.prisma.webhook.findMany({ where });
  }

  async update(id: string, data: Prisma.webhookUpdateInput): Promise<webhook> {
    return this.prisma.webhook.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<webhook> {
    // Soft delete
    return this.prisma.webhook.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async hardDelete(id: string): Promise<webhook> {
    return this.prisma.webhook.delete({
      where: { id },
    });
  }

  async restore(id: string): Promise<webhook> {
    return this.prisma.webhook.update({
      where: { id },
      data: { deleted_at: null },
    });
  }

  async countActive(companyId: string): Promise<number> {
    return this.prisma.webhook.count({
      where: {
        company_id: companyId,
        deleted_at: null,
      },
    });
  }

  // ===== WEBHOOK LOG CRUD =====

  async createLog(data: Prisma.webhook_logCreateInput): Promise<webhook_log> {
    return this.prisma.webhook_log.create({ data });
  }

  async findAllLogs(
    filters?: WebhookLogFiltersDto,
    includeDeleted: boolean = false,
  ): Promise<webhook_log[]> {
    const where: Prisma.webhook_logWhereInput = {};

    if (!includeDeleted) {
      where.deleted_at = null;
    }

    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.companyId) where.company_id = filters.companyId;
    if (filters?.webhookId) where.webhook_id = filters.webhookId;
    if (filters?.paymentId) where.payment_id = filters.paymentId;

    return this.prisma.webhook_log.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100, // Limitar para performance
    });
  }

  async findLogById(
    id: string,
    includeDeleted: boolean = false,
  ): Promise<webhook_log | null> {
    const where: Prisma.webhook_logWhereInput = { id };

    if (!includeDeleted) {
      where.deleted_at = null;
    }

    return this.prisma.webhook_log.findFirst({
      where,
      include: {
        webhook: true,
        payment: true,
        withdrawal: true,
      },
    });
  }

  async findPendingRetries(): Promise<webhook_log[]> {
    const logs = await this.prisma.webhook_log.findMany({
      where: {
        status: 'RETRYING',
        retry_at: { lte: new Date() },
        deleted_at: null,
      },
      include: {
        webhook: true,
      },
      take: 50,
    });

    // Filtrar os que ainda podem fazer retry
    return logs.filter((log) => log.retry_count < log.retry_limit);
  }

  async updateLog(
    id: string,
    data: Prisma.webhook_logUpdateInput,
  ): Promise<webhook_log> {
    return this.prisma.webhook_log.update({
      where: { id },
      data,
    });
  }

  async deleteLog(id: string): Promise<webhook_log> {
    // Soft delete
    return this.prisma.webhook_log.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async hardDeleteLog(id: string): Promise<webhook_log> {
    return this.prisma.webhook_log.delete({
      where: { id },
    });
  }

  async restoreLog(id: string): Promise<webhook_log> {
    return this.prisma.webhook_log.update({
      where: { id },
      data: { deleted_at: null },
    });
  }

  async getWebhookStats(webhookId: string): Promise<any> {
    const stats = await this.prisma.webhook_log.groupBy({
      by: ['status'],
      where: {
        webhook_id: webhookId,
        deleted_at: null,
      },
      _count: true,
    });

    return stats;
  }

  async getCompanyStats(companyId: string): Promise<any> {
    const stats = await this.prisma.webhook_log.groupBy({
      by: ['status', 'type'],
      where: {
        company_id: companyId,
        deleted_at: null,
      },
      _count: true,
    });

    return stats;
  }

  async cleanOldLogs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.webhook_log.updateMany({
      where: {
        created_at: { lt: cutoffDate },
        deleted_at: null,
      },
      data: { deleted_at: new Date() },
    });

    return result.count;
  }
}
