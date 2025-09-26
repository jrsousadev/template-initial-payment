// src/modules/api-key/services/api-key.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysRepository } from '../repositories/api-key.repository';
import { CompanyService } from 'src/modules/company/services/company.service';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { CacheConstants } from 'src/infrastructure/cache/cache.constans';
import {
  extractPermissionsForPrisma,
  extractPermissions,
} from 'src/common/permissions/permissions.enum';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ValidateApiKeyDto,
} from '../dto/api-key.dto';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly apiKeysRepository: ApiKeysRepository,
    private readonly companyService: CompanyService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Cria uma nova API key para a empresa
   */
  async create(companyId: string, createApiKeyDto: CreateApiKeyDto) {
    const company = await this.companyService.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const existingKeys =
      await this.apiKeysRepository.findByCompanyId(companyId);
    if (existingKeys.length >= 10) {
      throw new BadRequestException('Maximum number of API keys reached (10)');
    }

    const publicKey = this.generatePublicKey();
    const secretKey = this.generateSecretKey();

    // Usa spread para aplicar todas as permissões de uma vez
    const apiKey = await this.apiKeysRepository.create({
      description: createApiKeyDto.description,
      public: publicKey,
      secret: secretKey,
      ...extractPermissionsForPrisma(createApiKeyDto),
      company: {
        connect: { id: companyId },
      },
    });

    await this.cacheService.invalidateEntity('company', companyId);

    return {
      id: apiKey.id,
      description: apiKey.description,
      public: apiKey.public,
      secret: apiKey.secret,
      permissions: extractPermissions(apiKey),
      created_at: apiKey.created_at,
      warning:
        'Save these keys securely. The secret key will not be shown again.',
    };
  }

  /**
   * Lista todas as API keys da empresa
   */
  async findAll(companyId: string) {
    const company = await this.companyService.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const apiKeys = await this.apiKeysRepository.findByCompanyId(companyId);

    return apiKeys.map((key) => ({
      id: key.id,
      description: key.description,
      public: key.public,
      secret: this.maskSecretKey(key.secret),
      last_used_at: key.last_used_at,
      created_at: key.created_at,
      updated_at: key.updated_at,
      permissions: extractPermissions(key),
    }));
  }

  /**
   * Busca uma API key específica
   */
  async findOne(companyId: string, apiKeyId: string) {
    const apiKey = await this.getApiKeyWithValidation(companyId, apiKeyId);

    return {
      id: apiKey.id,
      description: apiKey.description,
      public: apiKey.public,
      secret: this.maskSecretKey(apiKey.secret),
      last_used_at: apiKey.last_used_at,
      created_at: apiKey.created_at,
      updated_at: apiKey.updated_at,
      permissions: extractPermissions(apiKey),
    };
  }

  /**
   * Atualiza API key (incluindo permissões)
   */
  async update(
    companyId: string,
    apiKeyId: string,
    updateApiKeyDto: UpdateApiKeyDto,
  ) {
    const apiKey = await this.getApiKeyWithValidation(companyId, apiKeyId);

    await this.invalidateApiKeyCache(apiKey.public, apiKey.secret);
    await this.cacheService.del(`api-key:${apiKeyId}`);

    // Constrói objeto de update dinamicamente
    const updateData: any = {};

    if (updateApiKeyDto.description !== undefined) {
      updateData.description = updateApiKeyDto.description;
    }

    // Adiciona apenas as permissões que foram enviadas
    const permissionsUpdate = extractPermissionsForPrisma(updateApiKeyDto);
    Object.assign(updateData, permissionsUpdate);

    const updated = await this.apiKeysRepository.update(apiKeyId, updateData);

    return {
      id: updated.id,
      description: updated.description,
      public: updated.public,
      permissions: extractPermissions(updated),
      updated_at: updated.updated_at,
    };
  }

  /**
   * Deleta (soft delete) uma API key
   */
  async delete(companyId: string, apiKeyId: string) {
    const apiKey = await this.apiKeysRepository.findById(apiKeyId);

    if (!apiKey || apiKey.company_id !== companyId) {
      throw new NotFoundException('API key not found');
    }

    if (apiKey.deleted_at) {
      throw new BadRequestException('API key already deleted');
    }

    // Invalida cache ANTES de deletar
    await this.invalidateApiKeyCache(apiKey.public, apiKey.secret);
    await this.cacheService.del(`api-key:${apiKeyId}`);

    // Agora deleta
    await this.apiKeysRepository.softDelete(apiKeyId);

    return {
      message: 'API key deleted successfully',
    };
  }

  /**
   * Valida API key (endpoint público)
   */
  async validate(validateApiKeyDto: ValidateApiKeyDto) {
    const { public_key, secret_key } = validateApiKeyDto;

    const cacheKey = this.cacheService.generateKey(
      { publicKey: public_key, secretKey: secret_key },
      `${CacheConstants.API_KEY_PREFIX}:validate`,
    );

    return this.cacheService.rememberWithLock(
      cacheKey,
      async () => {
        const apiKey = await this.apiKeysRepository.findByKeys(
          public_key,
          secret_key,
        );

        if (!apiKey) {
          throw new UnauthorizedException('Invalid API keys');
        }

        if (apiKey.deleted_at) {
          throw new UnauthorizedException('API key has been revoked');
        }

        if (apiKey.company.status !== 'ACTIVE') {
          throw new UnauthorizedException('Company is not active');
        }

        await this.apiKeysRepository.updateLastUsed(apiKey.id);

        return {
          valid: true,
          company_id: apiKey.company_id,
          api_key_id: apiKey.id,
          permissions: extractPermissions(apiKey),
        };
      },
      {
        ttl: CacheConstants.API_KEY_TTL,
        lockTimeout: 3000,
      },
    );
  }

  /**
   * Valida API key para autenticação (usado pelo Guard)
   */
  async validateApiForAuthByCredentials(publicKey: string, secretKey: string) {
    const apiKey = await this.apiKeysRepository.findByKeys(
      publicKey,
      secretKey,
    );

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API keys');
    }

    if (apiKey.deleted_at) {
      throw new UnauthorizedException('API key has been revoked');
    }

    if (apiKey.company.status !== 'ACTIVE') {
      throw new UnauthorizedException('Company is not active');
    }

    return {
      company_id: apiKey.company_id,
      api_key_id: apiKey.id,
      company: apiKey.company,
      permissions: extractPermissions(apiKey),
    };
  }

  /**
   * Regenera uma API key mantendo as mesmas permissões
   */
  async regenerate(companyId: string, apiKeyId: string) {
    const oldApiKey = await this.getApiKeyWithValidation(companyId, apiKeyId);

    // Invalida cache da chave antiga
    await this.invalidateApiKeyCache(oldApiKey.public, oldApiKey.secret);
    await this.cacheService.del(`api-key:${apiKeyId}`);

    // Marca a chave antiga como deletada
    await this.apiKeysRepository.softDelete(apiKeyId);

    // Gera novas chaves
    const publicKey = this.generatePublicKey();
    const secretKey = this.generateSecretKey();

    // Copia todas as permissões da chave antiga
    const newApiKey = await this.apiKeysRepository.create({
      description: `${oldApiKey.description} (Regenerated)`,
      public: publicKey,
      secret: secretKey,
      ...extractPermissionsForPrisma(oldApiKey),
      company: {
        connect: { id: companyId },
      },
    });

    return {
      id: newApiKey.id,
      description: newApiKey.description,
      public: newApiKey.public,
      secret: newApiKey.secret,
      permissions: extractPermissions(newApiKey),
      created_at: newApiKey.created_at,
      warning:
        'Save these keys securely. The secret key will not be shown again.',
    };
  }

  /**
   * Atualiza timestamp de último uso (chamado pelo Guard)
   */
  async updateLastUsedTimestamp(apiKeyId: string): Promise<void> {
    await this.apiKeysRepository.updateLastUsed(apiKeyId);
    await this.cacheService.del(`api-key:${apiKeyId}`);
  }

  /**
   * Invalida todos os caches relacionados a uma empresa
   */
  async invalidateCompanyCaches(companyId: string): Promise<void> {
    await this.cacheService.invalidateEntity('company', companyId);

    const apiKeys = await this.apiKeysRepository.findByCompanyId(companyId);

    const invalidations = apiKeys.map(async (apiKey) => {
      await this.invalidateApiKeyCache(apiKey.public, apiKey.secret);
      await this.cacheService.del(`api-key:${apiKey.id}`);
    });

    await Promise.all(invalidations);
  }

  // ==================== Métodos Privados ====================

  /**
   * Busca e valida API key (evita repetição)
   */
  private async getApiKeyWithValidation(companyId: string, apiKeyId: string) {
    const apiKey = await this.apiKeysRepository.findById(apiKeyId);

    if (!apiKey || apiKey.company_id !== companyId) {
      throw new NotFoundException('API key not found');
    }

    if (apiKey.deleted_at) {
      throw new BadRequestException('API key has been deleted');
    }

    return apiKey;
  }

  /**
   * Gera chave pública
   */
  private generatePublicKey(): string {
    const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    const random = crypto.randomBytes(24).toString('hex');
    return `pk_${env}_${random}`;
  }

  /**
   * Gera chave secreta
   */
  private generateSecretKey(): string {
    const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    const random = crypto.randomBytes(32).toString('hex');
    return `sk_${env}_${random}`;
  }

  /**
   * Mascara a chave secreta para exibição
   */
  private maskSecretKey(secret: string): string {
    if (!secret) return '';
    const prefix = secret.substring(0, 7);
    const suffix = secret.substring(secret.length - 4);
    return `${prefix}...${suffix}`;
  }

  /**
   * Invalida cache de uma API key específica
   */
  private async invalidateApiKeyCache(
    publicKey: string,
    secretKey: string,
  ): Promise<void> {
    const cacheKey = this.cacheService.generateKey(
      { publicKey, secretKey },
      CacheConstants.API_KEY_PREFIX,
    );

    const validateCacheKey = this.cacheService.generateKey(
      { publicKey, secretKey },
      `${CacheConstants.API_KEY_PREFIX}:validate`,
    );

    await this.cacheService.del([cacheKey, validateCacheKey]);
  }
}
