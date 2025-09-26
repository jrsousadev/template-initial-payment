import { devolution_type } from '@prisma/client';

export interface DevolutionsToCreateData {
  id: string;
  type: devolution_type;
  amount: number;
  amountFee: number;
  amountOrganization: number;
  amountProvider: number;

  taxRate: number;
  taxFee: number;

  taxRateProvider: number;
  taxFeeProvider: number;

  paymentId?: string;
  withdrawalId?: string;

  companyId: string;
}
