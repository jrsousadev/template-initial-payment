import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import {
  CreatePaymentItemData,
  PaymentItemData,
} from '../interfaces/payment-item.interfaces';

@Injectable()
export class PaymentItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(items: CreatePaymentItemData[]): Promise<PaymentItemData[]> {
    // Preparar dados com IDs gerados
    const itemsWithIds = items.map((item) => ({
      ...item,
      id: UniqueIDGenerator.generate(),
      sku: item.sku || null,
    }));

    // Usar createMany para inserção em batch
    await this.prisma.payment_item.createMany({
      data: itemsWithIds,
      skipDuplicates: false,
    });

    // Retornar os itens criados (o createMany não retorna os registros criados)
    return itemsWithIds;
  }

  async create(data: CreatePaymentItemData): Promise<PaymentItemData> {
    const paymentItem = await this.prisma.payment_item.create({
      data: {
        id: UniqueIDGenerator.generate(),
        name: data.name,
        sku: data.sku || null,
        unit_amount: data.unit_amount,
        quantity: data.quantity,
        payment_id: data.payment_id,
      },
    });

    return paymentItem;
  }

  async findByPaymentId(paymentId: string): Promise<PaymentItemData[]> {
    const items = await this.prisma.payment_item.findMany({
      where: { payment_id: paymentId },
      orderBy: { name: 'asc' },
    });

    return items;
  }

  async findByPaymentIds(paymentIds: string[]): Promise<PaymentItemData[]> {
    const items = await this.prisma.payment_item.findMany({
      where: {
        payment_id: {
          in: paymentIds,
        },
      },
      orderBy: [{ payment_id: 'asc' }, { name: 'asc' }],
    });

    return items;
  }

  async deleteByPaymentId(paymentId: string): Promise<number> {
    const result = await this.prisma.payment_item.deleteMany({
      where: { payment_id: paymentId },
    });

    return result.count;
  }

  async getTotalByPaymentId(paymentId: string): Promise<number> {
    const items = await this.prisma.payment_item.findMany({
      where: { payment_id: paymentId },
      select: {
        unit_amount: true,
        quantity: true,
      },
    });

    return items.reduce(
      (total, item) => total + item.unit_amount * item.quantity,
      0,
    );
  }

  async countByPaymentId(paymentId: string): Promise<number> {
    return await this.prisma.payment_item.count({
      where: { payment_id: paymentId },
    });
  }

  async existsByPaymentId(paymentId: string): Promise<boolean> {
    const count = await this.prisma.payment_item.count({
      where: { payment_id: paymentId },
      take: 1,
    });

    return count > 0;
  }
}
