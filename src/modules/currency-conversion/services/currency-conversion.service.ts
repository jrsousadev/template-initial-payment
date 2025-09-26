import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { transaction_currency } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { CompanyService } from 'src/modules/company/services/company.service';
import {
  CreateCurrencyConversionDto,
  ListCurrencyConversionsQueryDto,
} from '../dto/currency-conversion.dto';
import {
  CurrencyConversionCalculation,
  CurrencyConversionFilters,
  CurrencyConversionListResponse,
  CurrencyConversionResponse,
} from '../interfaces/currency-conversion.interfaces';
import { CurrencyConversionRepository } from '../repositories/currency-conversion.repository';

@Injectable()
export class CurrencyConversionService {
  private readonly logger = new Logger(CurrencyConversionService.name);

  // Mock de taxas de câmbio - em produção, buscar de uma API externa
  private readonly exchangeRates = {
    'USD-BRL': 5.05,
    'BRL-USD': 0.198,
    'EUR-BRL': 5.45,
    'BRL-EUR': 0.183,
    'USD-EUR': 0.92,
    'EUR-USD': 1.087,
  };

  constructor(
    private readonly repository: CurrencyConversionRepository,
    private readonly companyService: CompanyService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Calcular conversão de moeda
   */
  private async calculateConversion(
    companyId: string,
    dto: CreateCurrencyConversionDto,
  ): Promise<CurrencyConversionCalculation> {
    // Buscar configurações de taxa da empresa
    const taxConfig = await this.companyService.getTaxConfig(
      companyId,
      dto.original_currency,
    );

    if (!taxConfig) {
      throw new BadRequestException(
        'Company tax configuration not found for the specified currency',
      );
    }

    const rateKey = `${dto.original_currency}-${dto.converted_currency}`;
    const marketRate = this.exchangeRates[rateKey];

    if (!marketRate) {
      throw new BadRequestException(
        `Exchange rate not available for ${dto.original_currency} to ${dto.converted_currency}`,
      );
    }

    // Taxas da empresa (exemplo: 2% sobre a conversão)
    const companyRate = 0.02;
    const companyFee = 500; // R$ 5,00 em centavos

    // Taxas do provedor (exemplo: 1% sobre a conversão)
    const providerRate = 0.01;
    const providerFee = 0;

    // Calcular valores
    const amountBeforeFees = dto.original_amount * marketRate;
    const amountProvider = Math.floor(amountBeforeFees * providerRate);
    const amountOrganization =
      Math.floor(amountBeforeFees * companyRate) + companyFee;
    const amountFee = amountProvider + amountOrganization;

    const convertedAmount = Math.floor(
      amountBeforeFees - amountProvider - amountOrganization,
    );

    return {
      original_amount: dto.original_amount,
      original_currency: dto.original_currency,
      converted_amount: convertedAmount,
      converted_currency: dto.converted_currency,
      amount_fee: amountFee,
      amount_provider: amountProvider,
      amount_organization: amountOrganization,
      tax_fee_company: companyFee,
      tax_rate_company: companyRate,
      tax_rate_provider: providerRate,
      tax_fee_provider: providerFee,
      tax_rate_market: marketRate,
      effective_rate: convertedAmount / dto.original_amount,
      total_cost: amountFee,
    };
  }

  /**
   * Criar uma nova conversão de moeda
   */
  async create(
    companyId: string,
    dto: CreateCurrencyConversionDto,
  ): Promise<{ message: string; conversion: CurrencyConversionResponse }> {
    try {
      if (dto.original_currency === dto.converted_currency) {
        throw new BadRequestException(
          'Original and converted currencies must be different',
        );
      }

      if (dto.original_amount < 10000) {
        throw new BadRequestException(
          'Minimum conversion amount is 100.00 in currency units',
        );
      }

      // Verificar limite de conversões pendentes
      const pendingCount =
        await this.repository.getPendingConversionsCount(companyId);

      if (pendingCount >= 1) {
        throw new BadRequestException(
          'Maximum of 1 pending conversions allowed at a time',
        );
      }

      // Calcular conversão
      const calculation = await this.calculateConversion(companyId, dto);

      // Criar conversão em transação
      const conversion = await this.prisma.$transaction(async (tx) => {
        // Criar registro de conversão
        const conversionRecord = await tx.currency_conversion.create({
          data: {
            company_id: companyId,
            status: 'PENDING',
            original_amount: calculation.original_amount,
            original_currency: calculation.original_currency,
            converted_amount: calculation.converted_amount,
            converted_currency: calculation.converted_currency,
            amount_fee: calculation.amount_fee,
            amount_provider: calculation.amount_provider,
            amount_organization: calculation.amount_organization,
            tax_fee_company: calculation.tax_fee_company,
            tax_rate_company: calculation.tax_rate_company,
            tax_rate_provider: calculation.tax_rate_provider,
            tax_fee_provider: calculation.tax_fee_provider,
            tax_rate_market: calculation.tax_rate_market,
          },
        });

        // Criar item na fila para processamento
        const payload = {
          conversionId: conversionRecord.id,
        };

        // await tx.queue.create({
        //   data: {
        //     id: UniqueIDGenerator.generate(),
        //     type: 'CURRENCY_CONVERSION',
        //     payload: payload as any,
        //     company_id: companyId,
        //   },
        // });

        return conversionRecord;
      });

      return {
        message: 'Currency conversion created successfully',
        conversion: conversion as CurrencyConversionResponse,
      };
    } catch (error) {
      this.logger.error(
        `Error creating currency conversion: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Listar conversões de uma empresa
   */
  async list(
    companyId: string,
    query: ListCurrencyConversionsQueryDto,
  ): Promise<CurrencyConversionListResponse> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const filters: CurrencyConversionFilters = {};

      if (query.status) {
        filters.status = query.status;
      }

      if (query.original_currency) {
        filters.original_currency = query.original_currency;
      }

      if (query.converted_currency) {
        filters.converted_currency = query.converted_currency;
      }

      if (query.from_date) {
        filters.fromDate = new Date(query.from_date);
      }

      if (query.to_date) {
        filters.toDate = new Date(query.to_date);
      }

      const { data, total } = await this.repository.findByCompanyId(
        companyId,
        filters,
        { skip, take: limit },
      );

      return {
        data: data as CurrencyConversionResponse[],
        total,
        page,
        last_page: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(
        `Error listing currency conversions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Buscar uma conversão específica
   */
  async findOne(
    companyId: string,
    conversionId: string,
  ): Promise<CurrencyConversionResponse> {
    try {
      const conversion = await this.repository.findById(
        conversionId,
        companyId,
      );

      if (!conversion) {
        throw new NotFoundException('Currency conversion not found');
      }

      return conversion as CurrencyConversionResponse;
    } catch (error) {
      this.logger.error(
        `Error finding currency conversion: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Obter resumo de conversões
   */
  async getSummary(
    companyId: string,
    currency?: transaction_currency,
  ): Promise<any> {
    try {
      const where: any = { company_id: companyId };

      if (currency) {
        where.OR = [
          { original_currency: currency },
          { converted_currency: currency },
        ];
      }

      const [total, pending, completed, totalVolume] = await Promise.all([
        this.prisma.currency_conversion.count({ where }),
        this.prisma.currency_conversion.count({
          where: { ...where, status: 'PENDING' },
        }),
        this.prisma.currency_conversion.count({
          where: { ...where, status: 'COMPLETED' },
        }),
        this.prisma.currency_conversion.aggregate({
          where: { ...where, status: 'COMPLETED' },
          _sum: {
            original_amount: true,
            converted_amount: true,
            amount_fee: true,
          },
        }),
      ]);

      return {
        total_conversions: total,
        pending_conversions: pending,
        completed_conversions: completed,
        total_volume: {
          original: totalVolume._sum.original_amount || 0,
          converted: totalVolume._sum.converted_amount || 0,
          fees: totalVolume._sum.amount_fee || 0,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting conversion summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
