import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class ProviderTaxConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.provider_tax_configCreateInput) {
    return this.prisma.provider_tax_config.create({
      data,
    });
  }

  async findByProviderId(providerId: string) {
    return this.prisma.provider_tax_config.findUnique({
      where: { provider_id: providerId },
    });
  }

  async update(id: string, data: Prisma.provider_tax_configUpdateInput) {
    return this.prisma.provider_tax_config.update({
      where: { id },
      data,
    });
  }
}

@Injectable()
export class ProviderSubAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.provider_sub_accountCreateInput) {
    return this.prisma.provider_sub_account.create({
      data,
      include: {
        provider: true,
        company: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.provider_sub_account.findUnique({
      where: { id },
      include: {
        provider: true,
        company: true,
      },
    });
  }

  async findByCompanyAndProvider(companyId: string, providerId: string) {
    return this.prisma.provider_sub_account.findFirst({
      where: {
        company_id: companyId,
        provider_id: providerId,
      },
      include: {
        provider: true,
      },
    });
  }

  async findByCompany(companyId: string) {
    return this.prisma.provider_sub_account.findMany({
      where: { company_id: companyId },
      include: {
        provider: true,
      },
    });
  }

  async update(id: string, data: Prisma.provider_sub_accountUpdateInput) {
    return this.prisma.provider_sub_account.update({
      where: { id },
      data,
    });
  }
}
