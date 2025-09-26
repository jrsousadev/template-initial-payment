import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import {
  CreateReceiverData,
  UpdateReceiverData,
} from '../interfaces/receiver.interfaces';
import { Prisma, receiver_status } from '@prisma/client';
import { Receiver } from '../entitites/receiver.entity';

@Injectable()
export class ReceiverRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateReceiverData): Promise<Receiver> {
    const receiver = await this.prisma.receiver.create({
      data: {
        ...data,
        status: data.status || 'PENDING',
      },
    });

    return new Receiver(receiver);
  }

  async findById(id: string): Promise<Receiver | null> {
    const receiver = await this.prisma.receiver.findUnique({
      where: { id },
    });

    return receiver ? new Receiver(receiver) : null;
  }

  async findByIdAndCompany(
    id: string,
    companyId: string,
  ): Promise<Receiver | null> {
    const receiver = await this.prisma.receiver.findFirst({
      where: {
        id,
        company_id: companyId,
        deleted_at: null,
      },
    });

    return receiver ? new Receiver(receiver) : null;
  }

  async findAllByCompany(
    companyId: string,
    offset = 0,
    limit = 20,
    status?: receiver_status,
  ): Promise<{ data: Receiver[]; total: number }> {
    const where = {
      company_id: companyId,
      deleted_at: null,
      ...(status && { status }),
    };

    const [receivers, total] = await Promise.all([
      this.prisma.receiver.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.receiver.count({ where }),
    ]);

    return {
      data: receivers.map((r) => new Receiver(r)),
      total,
    };
  }

  async findActiveByCompany(companyId: string): Promise<Receiver[]> {
    const receivers = await this.prisma.receiver.findMany({
      where: {
        company_id: companyId,
        status: 'ACTIVE',
        deleted_at: null,
      },
      orderBy: { created_at: 'desc' },
    });

    return receivers.map((r) => new Receiver(r));
  }

  async update(id: string, data: UpdateReceiverData): Promise<Receiver> {
    const receiver = await this.prisma.receiver.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });

    return new Receiver(receiver);
  }

  async updateStatus(id: string, status: receiver_status): Promise<Receiver> {
    const receiver = await this.prisma.receiver.update({
      where: { id },
      data: {
        status,
        updated_at: new Date(),
      },
    });

    return new Receiver(receiver);
  }

  async softDelete(id: string): Promise<Receiver> {
    const receiver = await this.prisma.receiver.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    return new Receiver(receiver);
  }

  async checkDuplicate(
    companyId: string,
    data: {
      bank_account_number?: string;
      bank_code?: string;
      wallet_id?: string;
      pix_key?: string;
    },
  ): Promise<boolean> {
    const conditions: Prisma.receiverWhereInput[] = [];

    if (data.bank_account_number && data.bank_code) {
      conditions.push({
        bank_account_number: data.bank_account_number,
        bank_code: data.bank_code,
      });
    }

    if (data.wallet_id) {
      conditions.push({ wallet_id: data.wallet_id });
    }

    if (data.pix_key) {
      conditions.push({ pix_key: data.pix_key });
    }

    if (conditions.length === 0) return false;

    const existing = await this.prisma.receiver.findFirst({
      where: {
        company_id: companyId,
        deleted_at: null,
        OR: conditions,
      },
    });

    return !!existing;
  }
}
