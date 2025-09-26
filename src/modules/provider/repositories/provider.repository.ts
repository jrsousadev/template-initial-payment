import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class ProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.providerCreateInput) {
    return this.prisma.provider.create({
      data,
      include: {
        provider_tax_config: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.provider.findUnique({
      where: { id },
      include: {
        provider_tax_config: true,
        provider_sub_accounts: true,
      },
    });
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.providerWhereInput;
  }) {
    const { skip, take, where } = params || {};

    return this.prisma.provider.findMany({
      skip,
      take,
      where,
      include: {
        provider_tax_config: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findActive() {
    return this.prisma.provider.findMany({
      where: { is_active: true },
      include: {
        provider_tax_config: true,
      },
    });
  }

  async update(id: string, data: Prisma.providerUpdateInput) {
    return this.prisma.provider.update({
      where: { id },
      data,
      include: {
        provider_tax_config: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.provider.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
