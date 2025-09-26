import {
  infraction_type,
  infraction_status,
  infraction_analysis_result,
  payment_method,
} from '@prisma/client';

export interface CreateInfractionData {
  providerInfractionId: string;
  providerPaymentId?: string;
  infractionStatus: infraction_status;
  type: infraction_type;
  amount: number;
  reason: string;
  providerId: string;
  paymentId: string;
  companyId: string;
  paymentMethod: payment_method;
  analysisReason?: string;
  cancelledAt?: Date | null;
  closedAt?: Date | null;
  defendedAt?: Date | null;
  responsedAt?: Date | null;
  analysisResult?: infraction_analysis_result | null;
}

export interface UpdateInfractionData {
  status?: infraction_status;
  analysisResult?: infraction_analysis_result;
  analysisReason?: string;
}
