import { Injectable } from '@nestjs/common';
import { link_user_company_type, Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import {
  CompanyMemberFilters,
  PaginationOptions,
} from '../interfaces/link-user-company.interfaces';

@Injectable()
export class LinkUserCompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Criar link entre usuário e empresa
   */
  async create(data: Prisma.link_user_companyCreateInput) {
    return this.prisma.link_user_company.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Buscar link por ID
   */
  async findById(id: string) {
    return this.prisma.link_user_company.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        company: true,
      },
    });
  }

  /**
   * Buscar link por usuário e empresa
   */
  async findByUserAndCompany(userId: string, companyId: string) {
    return this.prisma.link_user_company.findUnique({
      where: {
        user_id_company_id: {
          user_id: userId,
          company_id: companyId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Listar membros de uma empresa
   */
  async findByCompanyId(
    companyId: string,
    filters: CompanyMemberFilters,
    pagination: PaginationOptions,
  ) {
    const where: Prisma.link_user_companyWhereInput = {
      company_id: companyId,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (!filters.include_banned) {
      where.banned_at = null;
    }

    const [data, total] = await Promise.all([
      this.prisma.link_user_company.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: {
          created_at: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.link_user_company.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Listar empresas de um usuário
   */
  async findByUserId(userId: string) {
    return this.prisma.link_user_company.findMany({
      where: {
        user_id: userId,
        banned_at: null,
      },
      include: {
        company: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  /**
   * Atualizar permissões
   */
  async update(id: string, data: Prisma.link_user_companyUpdateInput) {
    return this.prisma.link_user_company.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Atualizar por usuário e empresa
   */
  async updateByUserAndCompany(
    userId: string,
    companyId: string,
    data: Prisma.link_user_companyUpdateInput,
  ) {
    return this.prisma.link_user_company.update({
      where: {
        user_id_company_id: {
          user_id: userId,
          company_id: companyId,
        },
      },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Banir membro
   */
  async ban(userId: string, companyId: string) {
    return this.prisma.link_user_company.update({
      where: {
        user_id_company_id: {
          user_id: userId,
          company_id: companyId,
        },
      },
      data: {
        banned_at: new Date(),
      },
    });
  }

  /**
   * Desbanir membro
   */
  async unban(userId: string, companyId: string) {
    return this.prisma.link_user_company.update({
      where: {
        user_id_company_id: {
          user_id: userId,
          company_id: companyId,
        },
      },
      data: {
        banned_at: null,
      },
    });
  }

  /**
   * Remover membro
   */
  async delete(userId: string, companyId: string) {
    return this.prisma.link_user_company.delete({
      where: {
        user_id_company_id: {
          user_id: userId,
          company_id: companyId,
        },
      },
    });
  }

  /**
   * Contar membros de uma empresa
   */
  async countByCompanyId(companyId: string, type?: link_user_company_type) {
    const where: Prisma.link_user_companyWhereInput = {
      company_id: companyId,
      banned_at: null,
    };

    if (type) {
      where.type = type;
    }

    return this.prisma.link_user_company.count({ where });
  }

  /**
   * Verificar se usuário tem acesso à empresa
   */
  async hasAccess(userId: string, companyId: string): Promise<boolean> {
    const count = await this.prisma.link_user_company.count({
      where: {
        user_id: userId,
        company_id: companyId,
        banned_at: null,
      },
    });

    return count > 0;
  }

  /**
   * Verificar se usuário é owner da empresa
   */
  async isOwner(userId: string, companyId: string): Promise<boolean> {
    const count = await this.prisma.link_user_company.count({
      where: {
        user_id: userId,
        company_id: companyId,
        type: 'OWNED',
        banned_at: null,
      },
    });

    return count > 0;
  }

  /**
   * Obter permissões do usuário na empresa
   */
  async getUserPermissions(userId: string, companyId: string) {
    return this.prisma.link_user_company.findUnique({
      where: {
        user_id_company_id: {
          user_id: userId,
          company_id: companyId,
        },
      },
      select: {
        type: true,
        banned_at: true,
      },
    });
  }
}
