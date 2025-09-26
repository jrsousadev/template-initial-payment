import { Injectable } from '@nestjs/common';
import {
  Prisma,
  status_anticipation,
  transaction_currency,
} from '@prisma/client';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { CreateAnticipationData } from '../interfaces/anticipation.interfaces';

@Injectable()
export class AnticipationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAnticipationData) {
    return await this.prisma.anticipation.create({
      data: {
        id: data.id || UniqueIDGenerator.generate(),
        status: data.status || 'PENDING',
        group_payments_id: data.group_payments_id,
        total_amount: data.total_amount,
        amount_net: data.amount_net,
        amount_organization: data.amount_organization,
        amount_fee: data.amount_fee,
        type: data.type,
        tax: data.tax,
        fee: data.fee,
        company_id: data.company_id,
        currency: data.currency,
      },
    });
  }

  async findById(id: string) {
    return await this.prisma.anticipation.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });
  }

  async eligibleSchedules(
    companyId: string,
    now: Date,
    schedule_type: 'INSTALLMENT' | 'PENDING_TO_AVAILABLE',
    currency: transaction_currency,
  ) {
    const where: Prisma.payment_release_scheduleWhereInput = {
      company_id: companyId,
      status: 'SCHEDULED',
      is_anticipatable: true,
      type: schedule_type,
      scheduled_date: {
        gt: now,
      },
      is_anticipation_available_date: {
        lt: now,
      },
      currency,
    };

    return await this.prisma.payment_release_schedule.findMany({
      where,
      select: {
        id: true,
        payment_id: true,
        amount_net: true,
        scheduled_date: true,
        type: true,
        installment_number: true,
        total_installments: true,
        amount_fee: true,
        currency: true,
      },
      orderBy: [{ scheduled_date: 'asc' }, { amount_net: 'desc' }],
    });
  }

  async getAvailableGrouped(
    companyId: string,
    now: Date,
    currency: transaction_currency,
  ) {
    const schedules = await this.prisma.payment_release_schedule.groupBy({
      by: ['type', 'currency'],
      where: {
        company_id: companyId,
        status: 'SCHEDULED',
        is_anticipatable: true,
        is_anticipation_available_date: {
          lt: now,
        },
        scheduled_date: {
          gt: now,
        },
        currency,
      },
      _sum: {
        amount_net: true,
      },
      _count: {
        id: true,
      },
    });

    return schedules;
  }

  async getAvailableNextDates(
    companyId: string,
    now: Date,
    currency: transaction_currency,
  ) {
    const schedules = await this.prisma.payment_release_schedule.findMany({
      where: {
        company_id: companyId,
        status: 'SCHEDULED',
        is_anticipatable: true,
        is_anticipation_available_date: {
          lt: now,
        },
        scheduled_date: {
          gt: now,
        },
        currency,
      },
      select: {
        type: true,
        scheduled_date: true,
      },
      orderBy: {
        scheduled_date: 'asc',
      },
      take: 2,
    });

    return schedules;
  }

  async findByGroupPaymentsId(groupPaymentsId: string) {
    return await this.prisma.anticipation.findFirst({
      where: { group_payments_id: groupPaymentsId },
    });
  }

  async findByCompanyId(
    companyId: string,
    filters?: {
      status?: status_anticipation;
      fromDate?: Date;
      toDate?: Date;
    },
    pagination?: {
      skip: number;
      take: number;
    },
  ) {
    const where: any = {
      company_id: companyId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.fromDate || filters?.toDate) {
      where.created_at = {};
      if (filters.fromDate) {
        where.created_at.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.created_at.lte = filters.toDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.anticipation.findMany({
        where,
        orderBy: { created_at: 'desc' },
        ...pagination,
      }),
      this.prisma.anticipation.count({ where }),
    ]);

    return { data, total };
  }

  async updateStatus(
    id: string,
    status: status_anticipation,
    additionalData?: {
      approved_at?: Date;
      rejected_at?: Date;
      failed_at?: Date;
    },
  ) {
    return await this.prisma.anticipation.update({
      where: { id },
      data: {
        status,
        ...additionalData,
        updated_at: new Date(),
      },
    });
  }

  async getPendingAnticipations(companyId: string) {
    return await this.prisma.anticipation.findMany({
      where: {
        company_id: companyId,
        status: 'PENDING',
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async getPendingAnticipationCount(companyId: string) {
    return await this.prisma.anticipation.count({
      where: {
        company_id: companyId,
        status: {
          in: ['PENDING', 'PROCESSING'],
        },
      },
    });
  }

  async countPendingByCompanyId(companyId: string) {
    return await this.prisma.anticipation.count({
      where: {
        company_id: companyId,
        status: 'PENDING',
      },
    });
  }
}
