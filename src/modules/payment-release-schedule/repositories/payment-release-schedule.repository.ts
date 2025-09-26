// payment-release-schedule.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class PaymentReleaseScheduleRepository {
  constructor(private prisma: PrismaService) {}

  async findSchedulesToProcess(limit: number = 100) {
    return this.prisma.payment_release_schedule.findMany({
      where: {
        status: 'SCHEDULED',
        scheduled_date: { lte: new Date() },
      },
      take: limit,
      include: {
        payment: {
          include: {
            company: true,
            provider: true,
          },
        },
      },
      orderBy: { scheduled_date: 'asc' },
    });
  }

  async bulkCreate(data: Prisma.payment_release_scheduleCreateManyInput[], tx: Prisma.TransactionClient | null = null) {
    const client = tx || this.prisma;
    return client.payment_release_schedule.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async markAsProcessing(ids: string[]) {
    return this.prisma.payment_release_schedule.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PROCESSING' },
    });
  }

  async markAsCompleted(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;

    return client.payment_release_schedule.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        processed_at: new Date(),
      },
    });
  }

  async markAsFailed(id: string, error: string, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;

    return client.payment_release_schedule.update({
      where: { id },
      data: {
        status: 'FAILED',
        error_message: error,
        retry_count: { increment: 1 },
      },
    });
  }

  async findByPaymentId(
    paymentId: string,
    where?: Prisma.payment_release_scheduleWhereInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;

    return client.payment_release_schedule.findMany({
      where: {
        payment_id: paymentId,
        ...where,
      },
      include: {
        payment: {
          include: {
            company: true,
            provider: true,
          },
        },
      },
    });
  }

  async cancelByPaymentId(paymentId: string, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;

    return client.payment_release_schedule.updateMany({
      where: {
        payment_id: paymentId,
        status: 'SCHEDULED',
      },
      data: { status: 'CANCELLED' },
    });
  }
}
