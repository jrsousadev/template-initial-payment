import {
  devolution as PrismaDevolution,
  devolution_type,
} from '@prisma/client';

export class Devolution implements PrismaDevolution {
  id: string;
  type: devolution_type;
  amount: number;
  amount_fee: number;
  amount_organization: number;
  amount_provider: number;
  tax_rate: number;
  tax_fee: number;
  tax_rate_provider: number;
  tax_fee_provider: number;
  payment_id: string | null;
  company_id: string;
  created_at: Date;
  updated_at: Date;
  refunded_at: Date | null;
  withdrawal_id: string | null;

  constructor(data: PrismaDevolution) {
    this.validate(data);
    Object.assign(this, data);
  }

  private validate(data: PrismaDevolution): void {
    // Valida valores não negativos
    if (data.amount < 0) {
      throw new Error('Devolution amount cannot be negative');
    }

    if (
      data.amount_fee < 0 ||
      data.amount_organization < 0 ||
      data.amount_provider < 0
    ) {
      throw new Error('Fee amounts cannot be negative');
    }

    // Valida que total de fees não excede o amount
    const totalFees =
      data.amount_fee + data.amount_organization + data.amount_provider;
    if (totalFees > data.amount) {
      throw new Error(
        `Total fees (${totalFees}) cannot exceed devolution amount (${data.amount})`,
      );
    }

    // Valida taxas percentuais
    if (data.tax_rate < 0 || data.tax_rate > 100) {
      throw new Error('Tax rate must be between 0 and 100');
    }

    if (data.tax_rate_provider < 0 || data.tax_rate_provider > 100) {
      throw new Error('Provider tax rate must be between 0 and 100');
    }

    // Valida que tem company_id
    if (!data.company_id) {
      throw new Error('Company ID is required for devolution');
    }
  }
}
