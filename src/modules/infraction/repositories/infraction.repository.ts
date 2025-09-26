import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { Prisma, infraction } from '@prisma/client';

@Injectable()
export class InfractionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.infractionCreateInput): Promise<infraction> {
    return this.prisma.infraction.create({ data });
  }

  async createMany(
    data: Prisma.infractionCreateManyInput[],
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.infraction.createMany({ data, skipDuplicates: true });
  }

  async sumInfractionAmountByCompany(companyId: string): Promise<number> {
    const result = await this.prisma.infraction.aggregate({
      where: { company_id: companyId, status: {
        notIn: ['CLOSED', 'CANCELLED']
      } },
      _sum: { amount: true },
    });
    return result._sum.amount || 0;
  }

  async findById(id: string): Promise<infraction | null> {
    return this.prisma.infraction.findUnique({
      where: { id },
      include: {
        payment: true,
        provider: true,
        company: true,
      },
    });
  }

  async findByProviderInfractionId(
    providerInfractionId: string,
  ): Promise<infraction | null> {
    return this.prisma.infraction.findUnique({
      where: { provider_infraction_id: providerInfractionId },
    });
  }

  async findByCompany(companyId: string): Promise<infraction[]> {
    return this.prisma.infraction.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: 'desc' },
    });
  }

  async findPending(): Promise<infraction[]> {
    return this.prisma.infraction.findMany({
      where: { status: 'AWAITING_COMPANY_RESPONSE' },
      include: {
        payment: true,
        company: true,
      },
    });
  }

  async update(
    id: string,
    data: Prisma.infractionUpdateInput,
  ): Promise<infraction> {
    return this.prisma.infraction.update({
      where: { id },
      data,
    });
  }

  async updateByProviderInfractionId(
    providerInfractionId: string,
    data: Prisma.infractionUpdateInput,
  ): Promise<infraction> {
    return this.prisma.infraction.update({
      where: { provider_infraction_id: providerInfractionId },
      data,
    });
  }
}
