import {
  infraction as PrismaInfraction,
  infraction_type,
  infraction_status,
  infraction_analysis_result,
  $Enums,
} from '@prisma/client';

// (TO DO) Criar regras de negócios para utilizar no queue handler
export class Infraction implements PrismaInfraction {
  id: string;
  provider_infraction_id: string;
  provider_payment_id: string | null;
  type: infraction_type;
  analysis_result: infraction_analysis_result | null;
  payment_method: $Enums.payment_method;
  status: infraction_status;
  amount: number;
  reason: string;
  analysis_reason: string | null;
  responsed_at: Date | null;
  defended_at: Date | null;
  cancelled_at: Date | null;
  closed_at: Date | null;
  error_system_at: Date | null;
  provider_id: string;
  payment_id: string;
  company_id: string;
  created_at: Date;
  updated_at: Date;

  constructor(data: PrismaInfraction) {
    Object.assign(this, data);
  }

  canDefend(): boolean {
    return this.status === 'AWAITING_COMPANY_RESPONSE' && !this.defended_at;
  }

  canClose(): boolean {
    return this.status !== 'CLOSED' && this.status !== 'CANCELLED';
  }

  canCancel(): boolean {
    return this.status !== 'CLOSED' && this.status !== 'CANCELLED';
  }
}
