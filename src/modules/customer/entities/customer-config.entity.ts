import { customer_config as PrismaCustomerConfig } from '@prisma/client';

export class CustomerConfig implements PrismaCustomerConfig {
  id: string;
  customer_id: string;
  email_marketing_enabled: boolean;
  sms_marketing_enabled: boolean;
  tax_exempt_enabled: boolean;
  key: string;
  value: string;
  created_at: Date;
  updated_at: Date;

  constructor(data: PrismaCustomerConfig) {
    Object.assign(this, data);
  }
}
