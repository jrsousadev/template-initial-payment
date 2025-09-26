// api-keys/repositories/api-keys.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class ApiKeysRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.company_api_keysCreateInput) {
    return this.prisma.company_api_keys.create({
      data,
    });
  }

  async findById(id: string) {
    return this.prisma.company_api_keys.findUnique({
      where: { id },
    });
  }

  async findByPublicKey(publicKey: string) {
    return this.prisma.company_api_keys.findFirst({
      where: {
        public: publicKey,
        deleted_at: null,
      },
      include: {
        company: true,
      },
    });
  }

  async findBySecretKey(secretKey: string) {
    return this.prisma.company_api_keys.findFirst({
      where: {
        secret: secretKey,
        deleted_at: null,
      },
      include: {
        company: true,
      },
    });
  }

  async findByKeys(publicKey: string, secretKey: string) {
    return this.prisma.company_api_keys.findUnique({
      where: {
        secret_public: {
          secret: secretKey,
          public: publicKey,
        },
      },
      include: {
        company: {
          include: {
            company_tax_configs: true,
            company_config: true,
            provider_cashin_pix: {
              include: {
                provider_tax_config: true,
              },
            },
            provider_cashin_credit_card: {
              include: {
                provider_tax_config: true,
              },
            },
            provider_cashin_billet: {
              include: {
                provider_tax_config: true,
              },
            },
            provider_cashout: {
              include: {
                provider_tax_config: true,
              },
            },
          },
        },
      },
    });
  }

  async findByCompanyId(companyId: string) {
    return this.prisma.company_api_keys.findMany({
      where: {
        company_id: companyId,
        deleted_at: null,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async update(id: string, data: Prisma.company_api_keysUpdateInput) {
    return this.prisma.company_api_keys.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return this.prisma.company_api_keys.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
    });
  }

  async updateLastUsed(id: string) {
    return this.prisma.company_api_keys.update({
      where: { id },
      data: {
        last_used_at: new Date(),
      },
    });
  }
}
