import { Injectable } from '@nestjs/common';
import { Payment } from '../entities/payment.entity';
import { $Enums, provider_name } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import {
  CreatePaymentData,
  IPaymentResponse,
  UpdatePaymentData,
} from '../interfaces/transaction.interfaces';

@Injectable()
export class PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Create

  async create(data: CreatePaymentData): Promise<Payment> {
    const { payment_items, ...paymentData } = data;

    const payment = await this.prisma.payment.create({
      data: {
        ...paymentData,
        id: UniqueIDGenerator.generate(),
        status: data.status,
        ips: data.ips || [],
        create_provider_log: data.create_provider_log || {},
        approve_provider_log: data.approve_provider_log || {},
        refunded_provider_log: {},
        ...(data.payment_items && {
          payment_items: {
            createMany: {
              data: [
                {
                  name: 'Placeholder item',
                  quantity: 1,
                  unit_amount: data.amount,
                },
              ],
              skipDuplicates: true,
            },
          },
        }),
      },
    });

    return new Payment(payment);
  }

  // Find without company scoping

  async findById(id: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    return payment ? new Payment(payment) : null;
  }

  async findByEndToEndId(endToEndId: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findFirst({
      where: { end_to_end_id: endToEndId },
    });

    return payment ? new Payment(payment) : null;
  }

  async findByExternalId(externalId: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findFirst({
      where: { external_id: externalId },
    });

    return payment ? new Payment(payment) : null;
  }

  async findByProviderPaymentId(
    providerPaymentId: string,
    providerName: provider_name,
  ): Promise<Payment | null> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        provider_payment_id: providerPaymentId,
        provider_name: providerName,
      },
    });

    return payment ? new Payment(payment) : null;
  }

  async findAll(
    offset = 0,
    limit = 20,
  ): Promise<{
    data: Payment[];
    total: number;
  }> {
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        skip: offset,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.payment.count(),
    ]);

    return {
      data: payments.map((p) => new Payment(p)),
      total,
    };
  }

  // Find with company scoping

  async findByIdAndCompany(
    id: string,
    companyId: string,
  ): Promise<Payment | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id, company_id: companyId },
    });

    return payment ? new Payment(payment) : null;
  }

  async findByIdAndComapnyWithProvider(id: string, companyId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id, company_id: companyId },
      include: { provider: true },
    });

    return payment ?? null;
  }

  async findByExternalIdWithCompany(
    externalId: string,
    companyId: string,
  ): Promise<Payment | null> {
    const payment = await this.prisma.payment.findFirst({
      where: { external_id: externalId, company_id: companyId },
    });

    return payment ? new Payment(payment) : null;
  }

  async findAllWithCompany(
    companyId: string,
    offset = 0,
    limit = 20,
  ): Promise<{
    data: IPaymentResponse[];
    total: number;
  }> {
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        skip: offset,
        take: limit,
        orderBy: { created_at: 'desc' },
        where: { company_id: companyId },
      }),
      this.prisma.payment.count({
        where: { company_id: companyId },
      }),
    ]);

    return {
      data: payments.map((p) => new Payment(p).toJSON()),
      total,
    };
  }

  async findByEndToEndIdWithCompany(
    endToEndId: string,
    companyId: string,
  ): Promise<Payment | null> {
    const payment = await this.prisma.payment.findFirst({
      where: { end_to_end_id: endToEndId, company_id: companyId },
    });

    return payment ? new Payment(payment) : null;
  }

  async findPendingExpired(): Promise<Payment[]> {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        expired_at: {
          lt: new Date(),
        },
      },
    });

    return payments.map((p) => new Payment(p));
  }

  // Updates

  // async update(id: string, data: UpdatePaymentData): Promise<Payment> {
  //   const payment = await this.prisma.payment.update({
  //     where: { id },
  //     data: {
  //       ...data,
  //       updated_at: new Date(),
  //     },
  //   });

  //   return new Payment(payment);
  // }

  async save(payment: Payment): Promise<Payment> {
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        external_id: payment.external_id,
        provider_payment_id: payment.provider_payment_id,

        end_to_end_id: payment.end_to_end_id,

        status: payment.status,

        ips: payment.ips,
        refunded_provider_log: payment.refunded_provider_log,
        create_provider_log: payment.create_provider_log,
        approve_provider_log: payment.approve_provider_log,
        error_message: payment.error_message,

        // Status de disponibilidade
        available_status: payment.available_status,
        available_reserve_status: payment.available_reserve_status,

        // Parcelamento
        installments_qty_received: payment.installments_qty_received,
        installments_amount_received: payment.installments_amount_received,
        installments_amount_pending: payment.installments_amount_pending,

        // Timestamps
        approved_at: payment.approved_at,
        refunded_at: payment.refunded_at,
        refused_at: payment.refused_at,
        chargedback_at: payment.chargedback_at,
        refunded_processing_at: payment.refunded_processing_at,
        disputed_at: payment.disputed_at,
        expired_at: payment.expired_at,
        failed_at: payment.failed_at,
        error_system_at: payment.error_system_at,
        available_anticipation_at: payment.available_anticipation_at,
        anticipated_at: payment.anticipated_at,

        // Sempre atualiza o updated_at
        updated_at: new Date(),
      },
    });

    return new Payment(updated);
  }

  async updateStatus(
    id: string,
    status: $Enums.payment_status,
    additionalData?: {
      error_message?: string;
      approve_provider_log?: any;
      refunded_provider_log?: any;
    },
  ): Promise<Payment> {
    const data: any = {
      status,
      updated_at: new Date(),
      ...additionalData,
    };

    switch (status) {
      case 'APPROVED':
        data.approved_at = new Date();
        break;
      case 'REFUSED':
        data.refused_at = new Date();
        break;
      case 'REFUNDED':
        data.refunded_at = new Date();
        break;
      case 'FAILED':
        data.failed_at = new Date();
        break;
      case 'EXPIRED':
        data.expired_at = new Date();
        break;
      case 'CHARGEDBACK':
        data.chargedback_at = new Date();
        break;
      case 'IN_DISPUTE':
        data.disputed_at = new Date();
        break;
      case 'REFUNDED_PROCESSING':
        data.refunded_processing_at = new Date();
        break;
      case 'ERROR_SYSTEM':
        data.error_system_at = new Date();
        break;
    }

    const payment = await this.prisma.payment.update({
      where: { id },
      data,
    });

    return new Payment(payment);
  }
}
