// src/common/guards/api-key.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  company,
  company_config,
  company_tax_config,
  provider,
  provider_tax_config,
} from '@prisma/client';
import { CacheConstants } from 'src/infrastructure/cache/cache.constans';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { ApiKeysService } from 'src/modules/api-key/services/api-key.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, PermissionSet } from '../permissions/permissions.enum';

interface CachedApiKeyData {
  company_id: string;
  api_key_id: string;
  company: company & {
    company_tax_configs: company_tax_config[];
    company_config: company_config | null;
    provider_cashin_pix?:
      | (provider & {
          provider_tax_config?: provider_tax_config | null;
        })
      | null;
    provider_cashin_billet?:
      | (provider & {
          provider_tax_config?: provider_tax_config | null;
        })
      | null;
    provider_cashin_credit_card?:
      | (provider & {
          provider_tax_config?: provider_tax_config | null;
        })
      | null;
    provider_cashout?:
      | (provider & {
          provider_tax_config?: provider_tax_config | null;
        })
      | null;
  };
  permissions: PermissionSet;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly cacheService: CacheService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const publicKey = request.headers['x-api-key-public'];
    const secretKey = request.headers['x-api-key-secret'];

    if (!publicKey || !secretKey) {
      throw new UnauthorizedException('API keys are required');
    }

    try {
      const cacheKey = this.cacheService.generateKey(
        { publicKey, secretKey },
        CacheConstants.API_KEY_PREFIX,
      );

      const validation =
        await this.cacheService.rememberWithLock<CachedApiKeyData>(
          cacheKey,
          async () => {
            const result =
              await this.apiKeysService.validateApiForAuthByCredentials(
                publicKey,
                secretKey,
              );

            return {
              company_id: result.company_id,
              api_key_id: result.api_key_id,
              company: result.company,
              permissions: result.permissions,
            };
          },
          {
            ttl: CacheConstants.API_KEY_TTL,
            lockTimeout: 3000,
          },
        );

      // Atualiza last_used de forma assíncrona
      this.updateLastUsedAsync(validation.api_key_id);

      // Injeta dados na request
      request.company = validation.company;
      request.apiKeyId = validation.api_key_id;
      request.permissions = validation.permissions;

      // Verifica se é rota pública
      const isPublic = this.reflector.get<boolean>(
        'isPublic',
        context.getHandler(),
      );

      if (isPublic) {
        return true;
      }

      // Verifica permissões necessárias
      const requiredPermissions = this.reflector.get<Permission[]>(
        PERMISSIONS_KEY,
        context.getHandler(),
      );

      if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
      }

      // Verifica se tem pelo menos uma das permissões
      const hasPermission = requiredPermissions.some(
        (permission) => validation.permissions[permission] === true,
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
        );
      }

      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      console.error('API Key validation error:', error);
      throw new UnauthorizedException('Invalid API keys');
    }
  }

  /**
   * Atualiza last_used de forma assíncrona
   */
  private updateLastUsedAsync(apiKeyId: string): void {
    setImmediate(async () => {
      try {
        await this.apiKeysService.updateLastUsedTimestamp(apiKeyId);
      } catch (error) {
        console.error('Failed to update last used timestamp:', error);
      }
    });
  }

  /**
   * Invalida cache quando API key é atualizada/deletada
   */
  async invalidateApiKeyCache(
    publicKey: string,
    secretKey: string,
  ): Promise<void> {
    const cacheKey = this.cacheService.generateKey(
      { publicKey, secretKey },
      CacheConstants.API_KEY_PREFIX,
    );

    await this.cacheService.del(cacheKey);
  }

  /**
   * Invalida todos os caches de uma empresa
   */
  async invalidateCompanyCache(companyId: string): Promise<void> {
    await this.cacheService.invalidateEntity('company', companyId);

    console.log(
      `Company ${companyId} cache invalidated - API keys will expire naturally`,
    );
  }
}
