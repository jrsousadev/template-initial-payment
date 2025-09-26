import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { Withdrawal } from '../entities/withdrawal.entity';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class WithdrawalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.withdrawalCreateInput, getReceiver: boolean = false): Promise<Withdrawal> {
    const withdrawal = await this.prisma.withdrawal.create({
      data: {
        ...data,
        id: data.id || UniqueIDGenerator.generate(),
      },
      include: {
        receiver: getReceiver,
      }
    });

    return new Withdrawal(withdrawal);
  }

  async findById(id: string): Promise<Withdrawal | null> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
    });

    return withdrawal ? new Withdrawal(withdrawal) : null;
  }

  async findByIdAndCompany(
    id: string,
    companyId: string,
  ): Promise<Withdrawal | null> {
    const withdrawal = await this.prisma.withdrawal.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });

    return withdrawal ? new Withdrawal(withdrawal) : null;
  }

  async findByExternalId(externalId: string): Promise<Withdrawal | null> {
    const withdrawal = await this.prisma.withdrawal.findFirst({
      where: { external_id: externalId },
    });

    return withdrawal ? new Withdrawal(withdrawal) : null;
  }

  async findByExternalIdAndCompany(
    externalId: string,
    companyId: string,
  ): Promise<Withdrawal | null> {
    const withdrawal = await this.prisma.withdrawal.findFirst({
      where: {
        external_id: externalId,
        company_id: companyId,
      },
    });

    return withdrawal ? new Withdrawal(withdrawal) : null;
  }

  async findByEndToEndId(endToEndId: string): Promise<Withdrawal | null> {
    const withdrawal = await this.prisma.withdrawal.findFirst({
      where: { end_to_end_id: endToEndId },
    });

    return withdrawal ? new Withdrawal(withdrawal) : null;
  }

  async findByEndToEndIdAndCompany(
    endToEndId: string,
    companyId: string,
  ): Promise<Withdrawal | null> {
    const withdrawal = await this.prisma.withdrawal.findFirst({
      where: {
        end_to_end_id: endToEndId,
        company_id: companyId,
      },
    });

    return withdrawal ? new Withdrawal(withdrawal) : null;
  }

  async findAllByCompany(
    companyId: string,
    offset = 0,
    limit = 20,
  ): Promise<{
    data: Withdrawal[];
    total: number;
  }> {
    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where: { company_id: companyId },
        skip: offset,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          receiver: true,
        },
      }),
      this.prisma.withdrawal.count({
        where: { company_id: companyId },
      }),
    ]);

    return {
      data: withdrawals.map((w) => new Withdrawal(w)),
      total,
    };
  }
}
