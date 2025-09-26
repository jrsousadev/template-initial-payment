import { customer as PrismaCustomer } from '@prisma/client';

export class Customer implements PrismaCustomer {
  id: string;
  full_name: string;
  email: string;
  document: string;
  phone: string;
  created_at: Date;
  updated_at: Date;

  constructor(data: PrismaCustomer) {
    Object.assign(this, data);
  }

  isActive(): boolean {
    return true;
  }
}
