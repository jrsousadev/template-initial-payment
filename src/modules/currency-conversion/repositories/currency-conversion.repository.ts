import { Injectable } from '@nestjs/common';
import { $Enums, currency_conversion, Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import {
  CurrencyConversionFilters,
  PaginationOptions,
} from '../interfaces/currency-conversion.interfaces';

@Injectable()
export class CurrencyConversionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Criar uma nova conversão de moeda
   */
  async create(
    data: Prisma.currency_conversionCreateInput,
  ): Promise<currency_conversion> {
    return this.prisma.currency_conversion.create({
      data,
    });
  }

  /**
   * Buscar conversão por ID
   */
  async findById(
    id: string,
    companyId: string,
  ): Promise<currency_conversion | null> {
    return this.prisma.currency_conversion.findFirst({
      where: {
        id,
        company_id: companyId,
      },
    });
  }

  /**
   * Buscar conversões por empresa com filtros e paginação
   */
  async findByCompanyId(
    companyId: string,
    filters: CurrencyConversionFilters,
    pagination: PaginationOptions,
  ): Promise<{ data: currency_conversion[]; total: number }> {
    const where: Prisma.currency_conversionWhereInput = {
      company_id: companyId,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.original_currency) {
      where.original_currency = filters.original_currency;
    }

    if (filters.converted_currency) {
      where.converted_currency = filters.converted_currency;
    }

    if (filters.fromDate || filters.toDate) {
      where.created_at = {};
      if (filters.fromDate) {
        where.created_at.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.created_at.lte = filters.toDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.currency_conversion.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: {
          created_at: 'desc',
        },
      }),
      this.prisma.currency_conversion.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Atualizar status de uma conversão
   */
  async updateStatus(
    id: string,
    status: $Enums.currency_conversion_status,
    additionalData?: Partial<currency_conversion>,
  ): Promise<currency_conversion> {
    return this.prisma.currency_conversion.update({
      where: { id },
      data: {
        status,
        ...additionalData,
      },
    });
  }

  /**
   * Contar conversões pendentes de uma empresa
   */
  async getPendingConversionsCount(companyId: string): Promise<number> {
    return this.prisma.currency_conversion.count({
      where: {
        company_id: companyId,
        status: {
          in: ['PENDING', 'PROCESSING'],
        },
      },
    });
  }

  /**
   * Buscar conversões pendentes de uma empresa
   */
  async getPendingConversions(
    companyId: string,
  ): Promise<currency_conversion[]> {
    return this.prisma.currency_conversion.findMany({
      where: {
        company_id: companyId,
        status: 'PENDING',
      },
      orderBy: {
        created_at: 'asc',
      },
    });
  }
}
