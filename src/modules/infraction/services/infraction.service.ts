import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InfractionRepository } from '../repositories/infraction.repository';
import { Infraction } from '../entities/infraction.entity';
import { CreateInfractionData } from '../interfaces/infraction.interfaces';
import { infraction_analysis_result, Prisma } from '@prisma/client';

@Injectable()
export class InfractionService {
  constructor(private readonly repository: InfractionRepository) {}

  async create(data: CreateInfractionData): Promise<Infraction> {
    // Verificar duplicado
    const existing = await this.repository.findByProviderInfractionId(
      data.providerInfractionId,
    );

    if (existing) {
      throw new ConflictException('Infraction already exists');
    }

    const infraction = await this.repository.create({
      provider_infraction_id: data.providerInfractionId,
      provider_payment_id: data.providerPaymentId,
      type: data.type,
      amount: data.amount,
      reason: data.reason,
      payment_method: data.paymentMethod,
      provider: { connect: { id: data.providerId } },
      payment: { connect: { id: data.paymentId } },
      company: { connect: { id: data.companyId } },
    });

    return new Infraction(infraction);
  }

  async createMany(data: CreateInfractionData[]): Promise<Prisma.BatchPayload> {
    const infractionsInput: Prisma.infractionCreateManyInput[] = data.map(
      (d) => ({
        amount: d.amount,
        company_id: d.companyId,
        payment_id: d.paymentId,
        payment_method: d.paymentMethod,
        provider_id: d.providerId,
        provider_infraction_id: d.providerInfractionId,
        reason: d.reason,
        type: d.type,
        analysis_reason: d.analysisReason,
        cancelled_at: d.cancelledAt,
        closed_at: d.closedAt,
        defended_at: d.defendedAt,
        responsed_at: d.responsedAt,
        analysis_result: d.analysisResult,
        status: d.infractionStatus,
        provider_payment_id: d.providerPaymentId,
      }),
    );

    return await this.repository.createMany(infractionsInput);
  }

  async sumInfractionAmountByCompany(companyId: string): Promise<number> {
    return this.repository.sumInfractionAmountByCompany(companyId);
  }

  async findById(id: string): Promise<Infraction> {
    const infraction = await this.repository.findById(id);

    if (!infraction) {
      throw new NotFoundException('Infraction not found');
    }

    return new Infraction(infraction);
  }

  async findByProviderInfractionId(
    providerInfractionId: string,
  ): Promise<Infraction> {
    const infraction =
      await this.repository.findByProviderInfractionId(providerInfractionId);

    if (!infraction) {
      throw new NotFoundException('Infraction not found');
    }

    return new Infraction(infraction);
  }

  async findByCompany(companyId: string): Promise<Infraction[]> {
    const infractions = await this.repository.findByCompany(companyId);
    return infractions.map((i) => new Infraction(i));
  }

  async findPending(): Promise<Infraction[]> {
    const infractions = await this.repository.findPending();
    return infractions.map((i) => new Infraction(i));
  }

  async defend(
    id: string,
    analysisResult: infraction_analysis_result,
    analysisReason: string,
  ): Promise<Infraction> {
    const infraction = await this.findById(id);

    if (!infraction.canDefend()) {
      throw new Error('Cannot defend this infraction');
    }

    const updated = await this.repository.update(id, {
      analysis_result: analysisResult,
      analysis_reason: analysisReason,
      status: 'UNDER_REVIEW',
      defended_at: new Date(),
      responsed_at: new Date(),
    });

    return new Infraction(updated);
  }

  async close(id: string): Promise<Infraction> {
    const infraction = await this.findById(id);

    if (!infraction.canClose()) {
      throw new Error('Cannot close this infraction');
    }

    const updated = await this.repository.update(id, {
      status: 'CLOSED',
      closed_at: new Date(),
    });

    return new Infraction(updated);
  }

  async cancel(id: string): Promise<Infraction> {
    const infraction = await this.findById(id);

    if (!infraction.canCancel()) {
      throw new Error('Cannot cancel this infraction');
    }

    const updated = await this.repository.update(id, {
      status: 'CANCELLED',
      cancelled_at: new Date(),
    });

    return new Infraction(updated);
  }
}
