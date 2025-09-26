import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class CompanyConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.company_configCreateInput) {
    return this.prisma.company_config.create({
      data,
    });
  }

  async update(id: string, data: Prisma.company_configUpdateInput) {
    return this.prisma.company_config.update({
      where: { id },
      data,
    });
  }

  async findByCompanyId(companyId: string) {
    return this.prisma.company_config.findUnique({
      where: { company_id: companyId },
    });
  }
}
