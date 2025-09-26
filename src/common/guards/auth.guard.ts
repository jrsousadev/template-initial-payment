import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  iat: number;
  exp: number;
  type?: 'access' | 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  document?: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
  companies?: Array<{
    id: string;
    name: string;
    document: string;
    status: string;
    type: 'OWNED' | 'GUEST';
    // permissions: {
    //   read_payment: boolean;
    //   write_payment: boolean;
    //   read_withdrawal: boolean;
    //   write_withdrawal: boolean;
    // };
  }>;
  selected_company_id?: string;
  selected_company?: {
    id: string;
    name: string;
    document: string;
    status: string;
    type: 'OWNED' | 'GUEST';
    // permissions: {
    //   read_payment: boolean;
    //   write_payment: boolean;
    //   read_withdrawal: boolean;
    //   write_withdrawal: boolean;
    // };
  };
}

interface CachedUserData {
  user_id: string;
  email: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'secret';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Verifica se é rota pública
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );

    if (isPublic) {
      return true;
    }

    // Extrai o token do header Authorization
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    try {
      // Verifica e decodifica o token
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;

      // Verifica se é um token de acesso (não refresh)
      if (payload.type && payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Busca dados do usuário com cache
      const cacheKey = this.cacheService.generateKey(
        { userId: payload.sub },
        'USER_AUTH_',
      );

      const userData = await this.cacheService.rememberWithLock<CachedUserData>(
        cacheKey,
        async () => {
          const user = await this.loadUserData(payload.sub);

          if (!user) {
            throw new UnauthorizedException('User not found');
          }

          return {
            user_id: user.id,
            email: user.email,
            user: user,
          };
        },
        {
          ttl: 300, // 5 minutos de cache
          lockTimeout: 3000,
        },
      );

      // Verifica se o usuário está ativo
      if (!userData.user) {
        throw new UnauthorizedException('User account is not active');
      }

      // Extrai company_id do header ou query param
      const selectedCompanyId =
        request.headers['x-company-id'] ||
        request.query.company_id ||
        userData.user.selected_company_id;

      // Se houver uma empresa selecionada, valida o acesso
      if (selectedCompanyId) {
        const company = userData.user.companies?.find(
          (c) => c.id === selectedCompanyId,
        );

        if (!company) {
          throw new ForbiddenException(
            'You do not have access to this company',
          );
        }

        // Adiciona a empresa selecionada ao contexto
        userData.user.selected_company = company;
        userData.user.selected_company_id = selectedCompanyId;
      }

      // Injeta dados do usuário na request
      request.user = userData.user;
      request.userId = userData.user_id;
      request.userEmail = userData.email;

      // Se houver empresa selecionada, injeta também
      if (userData.user.selected_company) {
        request.company = await this.loadCompanyData(
          userData.user.selected_company.id,
        );
        // request.companyPermissions = userData.user.selected_company.permissions;
      }

      // Atualiza último acesso de forma assíncrona
      // this.updateLastAccessAsync(payload.sub);

      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      // Token inválido ou expirado
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }

      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      }

      console.error('Auth validation error:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Carrega dados completos do usuário
   */
  private async loadUserData(
    userId: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        links_user_companies: {
          where: {
            banned_at: null,
          },
          include: {
            company: {
              select: {
                id: true,
                name: true,
                document: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Mapeia as empresas com suas permissões
    const companies = user.links_user_companies.map((link) => ({
      id: link.company.id,
      name: link.company.name,
      document: link.company.document,
      status: link.company.status,
      type: link.type as 'OWNED' | 'GUEST',
      // permissions: {
      //   read_payment: link.read_payment,
      //   write_payment: link.write_payment,
      //   read_withdrawal: link.read_withdrawal,
      //   write_withdrawal: link.write_withdrawal,
      // },
    }));

    // Busca a última empresa acessada (se houver)
    const lastAccessedCompany = await this.getLastAccessedCompany(userId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      document: user.document,
      // avatar_url: user.avatar_url,
      created_at: user.created_at,
      updated_at: user.updated_at,
      companies,
      selected_company_id: lastAccessedCompany,
    };
  }

  /**
   * Carrega dados completos da empresa
   */
  private async loadCompanyData(companyId: string) {
    return this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        company_tax_configs: true,
        company_config: true,
      },
    });
  }

  /**
   * Busca a última empresa acessada pelo usuário
   */
  private async getLastAccessedCompany(
    userId: string,
  ): Promise<string | undefined> {
    // Você pode implementar uma tabela user_preferences ou user_session
    // Por enquanto, retorna a primeira empresa OWNED ou a primeira disponível
    const link = await this.prisma.link_user_company.findFirst({
      where: {
        user_id: userId,
        banned_at: null,
      },
      orderBy: [
        { type: 'asc' }, // OWNED vem antes de GUEST
        { created_at: 'desc' },
      ],
    });

    return link?.company_id;
  }

  /**
   * Atualiza último acesso do usuário de forma assíncrona
   */
  // private updateLastAccessAsync(userId: string): void {
  //   setImmediate(async () => {
  //     try {
  //       await this.prisma.user.update({
  //         where: { id: userId },
  //         data: {
  //           last_access_at: new Date(),
  //         },
  //       });
  //     } catch (error) {
  //       console.error('Failed to update last access:', error);
  //     }
  //   });
  // }

  /**
   * Invalida cache do usuário
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const cacheKey = this.cacheService.generateKey({ userId }, 'USER_AUTH_');

    await this.cacheService.del(cacheKey);
  }

  /**
   * Invalida cache de todos os usuários de uma empresa
   */
  async invalidateCompanyUsersCache(companyId: string): Promise<void> {
    // Busca todos os usuários da empresa
    const users = await this.prisma.link_user_company.findMany({
      where: { company_id: companyId },
      select: { user_id: true },
    });

    // Invalida cache de cada usuário
    await Promise.all(users.map((u) => this.invalidateUserCache(u.user_id)));
  }
}
