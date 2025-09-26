import { Injectable } from '@nestjs/common';
import { Prisma, transaction_currency } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class CompanyTaxConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.company_tax_configCreateInput) {
    return this.prisma.company_tax_config.create({
      data,
    });
  }

  async findByCompanyId(companyId: string) {
    return this.prisma.company_tax_config.findFirst({
      where: { company_id: companyId },
    });
  }

  async findByCompanyTaxConfigByCurrency(
    companyId: string,
    currency: transaction_currency,
  ) {
    return this.prisma.company_tax_config.findFirst({
      where: {
        company_id: companyId,
        currency: currency,
      },
    });
  }

  async findAllByCompanyId(companyId: string) {
    return this.prisma.company_tax_config.findMany({
      where: { company_id: companyId },
      orderBy: { currency: 'asc' },
    });
  }

  async findAllByCompanyIdGroupedByCurrency(companyId: string) {
    const configs = await this.prisma.company_tax_config.findMany({
      where: { company_id: companyId },
      orderBy: { currency: 'asc' },
    });

    // Agrupa por currency para facilitar o uso
    return configs.reduce(
      (acc, config) => {
        acc[config.currency] = config;
        return acc;
      },
      {} as Record<transaction_currency, (typeof configs)[0]>,
    );
  }

  async update(id: string, data: Prisma.company_tax_configUpdateInput) {
    return this.prisma.company_tax_config.update({
      where: { id },
      data,
    });
  }

  async updateByCompanyIdAndCurrency(
    companyId: string,
    currency: transaction_currency,
    data: Prisma.company_tax_configUpdateInput,
  ) {
    // Primeiro tenta encontrar a configuração existente
    const existingConfig = await this.findByCompanyTaxConfigByCurrency(
      companyId,
      currency,
    );

    if (existingConfig) {
      return this.prisma.company_tax_config.update({
        where: { id: existingConfig.id },
        data,
      });
    }

    // Se não existir, cria uma nova
    return this.prisma.company_tax_config.create({
      data: {
        ...data,
        company_id: companyId,
        currency,
      } as Prisma.company_tax_configCreateInput,
    });
  }

  async upsert(
    companyId: string,
    currency: transaction_currency,
    data: Omit<Prisma.company_tax_configCreateInput, 'company_id' | 'currency'>,
  ) {
    const existingConfig = await this.findByCompanyTaxConfigByCurrency(
      companyId,
      currency,
    );

    if (existingConfig) {
      return this.prisma.company_tax_config.update({
        where: { id: existingConfig.id },
        data,
      });
    }

    return this.prisma.company_tax_config.create({
      data: {
        ...data,
        company_id: companyId,
        currency,
      } as Prisma.company_tax_configCreateInput,
    });
  }

  async countByCompanyId(companyId: string) {
    return this.prisma.company_tax_config.count({
      where: { company_id: companyId },
    });
  }

  async existsByCompanyIdAndCurrency(
    companyId: string,
    currency: transaction_currency,
  ): Promise<boolean> {
    const count = await this.prisma.company_tax_config.count({
      where: {
        company_id: companyId,
        currency: currency,
      },
    });

    return count > 0;
  }
}
