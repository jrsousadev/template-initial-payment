import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { transaction_currency } from '@prisma/client';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { CompanyService } from 'src/modules/company/services/company.service';
import { v4 } from 'uuid';
import {
  CreateAnticipationDto,
  ListAnticipationsQueryDto,
  SimulateAnticipationDto,
} from '../dto/anticipation.dto';
import {
  AnticipationCalculation,
  AvailableSchedulesResponse,
} from '../interfaces/anticipation.interfaces';
import { AnticipationRepository } from '../repositories/anticipation.repository';

@Injectable()
export class AnticipationService {
  private readonly logger = new Logger(AnticipationService.name);

  constructor(
    private readonly repository: AnticipationRepository,
    private readonly companyService: CompanyService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Busca schedules disponíveis para antecipação
   */
  async getAvailable(
    companyId: string,
    currency: transaction_currency,
  ): Promise<AvailableSchedulesResponse> {
    try {
      if (!currency) {
        throw new BadRequestException('Currency parameter is required');
      }

      const now = new Date();
      const grouped = await this.repository.getAvailableGrouped(
        companyId,
        now,
        currency,
      );
      const nextDates = await this.repository.getAvailableNextDates(
        companyId,
        now,
        currency,
      );

      const installments = grouped.find((g) => g.type === 'INSTALLMENT');
      const pendingToAvailable = grouped.find(
        (g) => g.type === 'PENDING_TO_AVAILABLE',
      );

      return {
        installments: {
          count: installments?._count?.id || 0,
          total_amount: installments?._sum?.amount_net || 0,
          next_release_date:
            nextDates.find((d) => d.type === 'INSTALLMENT')?.scheduled_date ||
            null,
        },
        pending_to_available: {
          count: pendingToAvailable?._count?.id || 0,
          total_amount: pendingToAvailable?._sum?.amount_net || 0,
          next_release_date:
            nextDates.find((d) => d.type === 'PENDING_TO_AVAILABLE')
              ?.scheduled_date || null,
        },
        total: {
          count:
            (installments?._count?.id || 0) +
            (pendingToAvailable?._count?.id || 0),
          total_amount:
            (installments?._sum?.amount_net || 0) +
            (pendingToAvailable?._sum?.amount_net || 0),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting available schedules: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Simula uma antecipação
   */
  async simulate(
    companyId: string,
    dto: SimulateAnticipationDto,
  ): Promise<AnticipationCalculation> {
    try {
      if (!dto.currency) {
        throw new BadRequestException('Currency parameter is required');
      }

      if (
        dto.scheduleType !== 'INSTALLMENT' &&
        dto.scheduleType !== 'PENDING_TO_AVAILABLE'
      ) {
        throw new BadRequestException('Invalid scheduleType parameter');
      }

      const now = new Date();

      const eligibleSchedules = await this.repository.eligibleSchedules(
        companyId,
        now,
        dto.scheduleType,
        dto.currency,
      );

      if (eligibleSchedules.length === 0) {
        throw new BadRequestException(
          'No eligible schedules found for anticipation',
        );
      }

      const taxConfig = await this.companyService.getTaxConfig(
        companyId,
        dto.currency,
      );

      if (!taxConfig) {
        throw new BadRequestException(
          'Company tax configuration not found for the specified currency',
        );
      }

      const monthlyRate = taxConfig.tax_rate_anticipation;
      const fee = taxConfig.tax_fee_anticipation || 0;

      let totalGross = 0;
      let totalDiscount = 0;
      const selectedSchedules: any[] = [];
      const paymentsIds: string[] = [];

      for (const schedule of eligibleSchedules) {
        // Calcular dias até liberação
        const daysToRelease = Math.ceil(
          (schedule.scheduled_date.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        const dailyRate = monthlyRate / 100 / 30;
        const discount =
          Math.floor(schedule.amount_net * dailyRate * daysToRelease) + fee;
        const netAmount = schedule.amount_net - discount;

        paymentsIds.push(schedule.payment_id);
        selectedSchedules.push({
          schedule_id: schedule.id,
          payment_id: schedule.payment_id,
          type: schedule.type,
          original_amount: schedule.amount_net,
          discount: discount,
          net_amount: netAmount,
          days_anticipated: daysToRelease,
          scheduled_date: schedule.scheduled_date,
          installment_info: schedule.installment_number
            ? `${schedule.installment_number}/${schedule.total_installments}`
            : null,
        });

        totalGross += schedule.amount_net;
        totalDiscount += discount;
      }

      return {
        schedules: selectedSchedules,
        summary: {
          total_gross: totalGross,
          total_discount: totalDiscount,
          total_net: totalGross - totalDiscount,
          anticipation_rate: monthlyRate,
          schedules_count: selectedSchedules.length,
        },
        payments_ids: paymentsIds,
        fees: {
          tax_fee_anticipation: taxConfig.tax_fee_anticipation,
          tax_rate_anticipation: taxConfig.tax_rate_anticipation,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error simulating anticipation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Lista antecipações de uma empresa
   */
  async list(companyId: string, query: ListAnticipationsQueryDto) {
    try {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const skip = (page - 1) * limit;

      const filters: any = {};

      if (query.status) {
        filters.status = query.status;
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
        data,
        total,
        page,
        last_page: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(
        `Error listing anticipations: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Criar antecipação de uma empresa
   */
  async create(companyId: string, dto: CreateAnticipationDto) {
    try {
      const simulation = await this.simulate(companyId, dto);

      if (simulation.summary.total_net < 1000) {
        throw new BadRequestException(
          'Minimum anticipation amount is 10.00 in currency units',
        );
      }

      const countPendingAnticipation =
        await this.repository.getPendingAnticipationCount(companyId);

      if (countPendingAnticipation >= 1) {
        throw new BadRequestException(
          'Only one pending anticipation is allowed at a time',
        );
      }

      const group_payments_id = `grp_${v4()}`;

      await this.prisma.$transaction(async (tx) => {
        const anticipation = await tx.anticipation.create({
          data: {
            amount_net: simulation.summary.total_net,
            amount_organization: simulation.summary.total_discount,
            amount_fee: simulation.summary.total_discount,
            group_payments_id,
            company_id: companyId,
            tax: simulation.fees.tax_rate_anticipation,
            fee: simulation.fees.tax_fee_anticipation,
            total_amount: simulation.summary.total_gross,
            currency: dto.currency,
            type: dto.scheduleType,
            payments_ids: simulation.payments_ids,
          },
        });

        const payload: { anticipationId: string } = {
          anticipationId: anticipation.id,
        };

        await tx.queue.create({
          data: {
            id: UniqueIDGenerator.generate(),
            type: 'ANTICIPATION',
            payload: payload as any,
            company_id: companyId,
            anticipation_id: anticipation.id,
          },
        });
      });

      return {
        message: 'Anticipation request created successfully',
      };
    } catch (err) {
      this.logger.error(
        `Error creating anticipation: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}
