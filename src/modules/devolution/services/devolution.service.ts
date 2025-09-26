import { Injectable } from '@nestjs/common';
import { DevolutionRepository } from '../repositories/devolution.repository';
import { DevolutionsToCreateData } from '../interfaces/devolution.interfaces';

@Injectable()
export class DevolutionService {
  constructor(private readonly repository: DevolutionRepository) {}

  async createMany(devolutions: DevolutionsToCreateData[]) {
    const inputs = devolutions.map((dev) => ({
      id: dev.id,
      amount: dev.amount,
      company_id: dev.companyId,
      payment_id: dev.paymentId ?? undefined,
      withdrawal_id: dev.withdrawalId ?? undefined,
      amount_fee: dev.amountFee,
      amount_organization: dev.amountOrganization,
      amount_provider: dev.amountProvider,
      refunded_at: new Date(),
      tax_fee: dev.taxFee,
      tax_rate: dev.taxRate,
      tax_fee_provider: dev.taxFeeProvider,
      tax_rate_provider: dev.taxRateProvider,
      type: dev.type,
    }));

    return this.repository.createMany(inputs);
  }
}
