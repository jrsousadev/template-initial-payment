// repositories/company.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.companyCreateInput) {
    return this.prisma.company.create({
      data,
      include: {
        company_tax_configs: true,
        company_config: true,
        wallets: true,
      },
    });
  }

  async update(id: string, data: Prisma.companyUpdateInput) {
    return this.prisma.company.update({
      where: { id },
      data,
    });
  }

  async findByIdWithWallets(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        wallets: {
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });
  }

  async findByIdCompleted(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        company_tax_configs: true,
        company_config: true,
        company_document: true,
        wallets: {
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
    });
  }

  async findByDocument(document: string) {
    return this.prisma.company.findFirst({
      where: { document },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.company.findFirst({
      where: { email },
    });
  }
}
