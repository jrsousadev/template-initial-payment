import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class CompanyDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.company_documentCreateInput) {
    return this.prisma.company_document.create({
      data,
    });
  }

  async findByCompanyId(companyId: string) {
    return this.prisma.company_document.findUnique({
      where: { company_id: companyId },
    });
  }
}
