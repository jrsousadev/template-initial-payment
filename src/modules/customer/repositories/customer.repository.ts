import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { Prisma, customer, customer_config } from '@prisma/client';

@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ===== CUSTOMER =====

  async create(data: Prisma.customerCreateInput): Promise<customer> {
    return this.prisma.customer.create({ data });
  }

  async findById(id: string): Promise<customer | null> {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        customer_config: true,
      },
    });
  }

  async findByEmail(email: string): Promise<customer | null> {
    return this.prisma.customer.findUnique({
      where: { email },
      include: {
        customer_config: true,
      },
    });
  }

  async findByDocument(document: string): Promise<customer | null> {
    return this.prisma.customer.findFirst({
      where: { document },
    });
  }

  async update(
    id: string,
    data: Prisma.customerUpdateInput,
  ): Promise<customer> {
    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<customer> {
    return this.prisma.customer.delete({
      where: { id },
    });
  }

  async findOrCreate(
    email: string,
    data?: {
      fullName?: string;
      document?: string;
      phone?: string;
    },
  ): Promise<{ customer: customer; created: boolean }> {
    const existing = await this.prisma.customer.findUnique({
      where: { email },
    });

    if (existing) {
      return { customer: existing, created: false };
    }

    const newCustomer = await this.prisma.customer.create({
      data: {
        email,
        full_name: data?.fullName || 'Cliente',
        document: data?.document,
        phone: data?.phone || '',
      },
    });

    return { customer: newCustomer, created: true };
  }

  // ===== CUSTOMER ADDRESS =====

  async createOrUpdateConfig(
    customerId: string,
    data: Prisma.customer_configCreateInput | Prisma.customer_configUpdateInput,
  ): Promise<customer_config> {
    return this.prisma.customer_config.upsert({
      where: { customer_id: customerId },
      create: data as Prisma.customer_configCreateInput,
      update: data as Prisma.customer_configUpdateInput,
    });
  }

  async findConfig(customerId: string): Promise<customer_config | null> {
    return this.prisma.customer_config.findUnique({
      where: { customer_id: customerId },
    });
  }
}
