import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache, CacheOptions } from '@nestjs/cache-manager';
import * as crypto from 'crypto';
import { CacheConstants } from './cache.constans';
import { CachedData } from './cache.interfaces';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly metricsEnabled = process.env.CACHE_METRICS === 'true';

  // Métricas
  private metrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    sets: 0,
    deletes: 0,
  };

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    // Log de métricas a cada 5 minutos se habilitado
    if (this.metricsEnabled) {
      setInterval(() => this.logMetrics(), 300000);
    }
  }

  /**
   * Gera uma chave de cache com hash SHA-256
   */
  generateKey(data: string | object, prefix?: string): string {
    const dataStr = typeof data === 'object' ? JSON.stringify(data) : data;
    const hash = crypto.createHash('sha256').update(dataStr).digest('hex');
    return prefix ? `${prefix}:${hash}` : hash;
  }

  /**
   * Busca valor do cache com tipo genérico
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.cacheManager.get<CachedData<T>>(key);

      if (cached) {
        // Verifica se não expirou
        if (cached.expiresAt && Date.now() > cached.expiresAt) {
          await this.del(key);
          this.metrics.misses++;
          return null;
        }

        this.metrics.hits++;
        return cached.data;
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error(`Cache GET error for key ${key}:`, error);
      return null; // Falha silenciosa
    }
  }

  /**
   * Armazena valor no cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const ttlSeconds = ttl || CacheConstants.DEFAULT_TTL;
      const cachedData: CachedData<T> = {
        data: value,
        cachedAt: Date.now(),
        expiresAt: Date.now() + ttlSeconds * 1000,
      };

      await this.cacheManager.set(key, cachedData, ttlSeconds * 1000);
      this.metrics.sets++;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error(`Cache SET error for key ${key}:`, error);
      // Não lança erro - continua sem cache
    }
  }

  /**
   * Remove valor do cache
   */
  async del(key: string | string[]): Promise<void> {
    try {
      if (Array.isArray(key)) {
        await Promise.all(key.map((k) => this.cacheManager.del(k)));
        this.metrics.deletes += key.length;
      } else {
        await this.cacheManager.del(key);
        this.metrics.deletes++;
      }
    } catch (error) {
      this.metrics.errors++;
      this.logger.error(`Cache DEL error:`, error);
    }
  }

  /**
   * Limpa cache por padrão (prefix)
   */
  async clearByPattern(pattern: string): Promise<void> {
    // Nota: Redis não suporta wildcard nativamente no cache-manager
    // Implementação específica seria necessária com redis client direto
    this.logger.warn(
      `Pattern clear requested for: ${pattern} - not implemented`,
    );
  }

  /**
   * Wrapper para cache automático de funções
   */
  async remember<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // Skip cache se configurado
    if (options?.skipCache) {
      return factory();
    }

    const cacheKey = options?.prefix ? `${options.prefix}:${key}` : key;

    // Tenta buscar do cache
    const cached = await this.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Se não encontrou, executa factory
    const result = await factory();

    // Armazena no cache
    await this.set(cacheKey, result, options?.ttl);

    return result;
  }

  /**
   * Cache com lock para evitar thundering herd
   */
  async rememberWithLock<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions & { lockTimeout?: number },
  ): Promise<T> {
    const lockKey = `lock:${key}`;
    const lockTimeout = options?.lockTimeout || 5000; // 5 segundos padrão

    // Tenta adquirir lock
    const lockValue = `${Date.now()}:${Math.random()}`;
    const acquired = await this.acquireLock(lockKey, lockValue, lockTimeout);

    if (!acquired) {
      // Aguarda e tenta buscar do cache novamente
      await new Promise((resolve) => setTimeout(resolve, 100));

      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Se ainda não tem cache, aguarda mais um pouco
      await new Promise((resolve) => setTimeout(resolve, 200));
      return this.rememberWithLock(key, factory, options);
    }

    try {
      // Com lock adquirido, verifica cache novamente
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Executa factory
      const result = await factory();

      // Armazena no cache
      await this.set(key, result, options?.ttl);

      return result;
    } finally {
      // Libera lock
      await this.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Cache de entidades relacionadas (para o processamento de payments)
   */
  async cacheRelatedEntities<T>(
    entityType: 'company' | 'provider' | 'webhook',
    entityId: string,
    factory: () => Promise<T>,
    ttl: number = CacheConstants.ENTITY_TTL,
  ): Promise<T> {
    const key = `${entityType}:full:${entityId}`;
    return this.remember(key, factory, { ttl });
  }

  /**
   * Invalida cache de entidade
   */
  async invalidateEntity(entityType: string, entityId: string): Promise<void> {
    const key = `${entityType}:full:${entityId}`;
    await this.del(key);
  }

  /**
   * Batch get - busca múltiplas chaves
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    // Processa em chunks para não sobrecarregar
    const chunkSize = 100;
    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize);
      const promises = chunk.map(async (key) => {
        const value = await this.get<T>(key);
        if (value !== null) {
          result.set(key, value);
        }
      });

      await Promise.all(promises);
    }

    return result;
  }

  // Métodos privados

  private async acquireLock(
    key: string,
    value: string,
    timeout: number,
  ): Promise<boolean> {
    try {
      const existing = await this.cacheManager.get(key);
      if (existing) {
        return false;
      }

      await this.cacheManager.set(key, value, timeout);

      // Verifica se realmente adquiriu (evita race condition)
      const check = await this.cacheManager.get(key);
      return check === value;
    } catch (error) {
      this.logger.error(`Lock acquire error:`, error);
      return false;
    }
  }

  private async releaseLock(key: string, value: string): Promise<void> {
    try {
      const current = await this.cacheManager.get(key);
      if (current === value) {
        await this.del(key);
      }
    } catch (error) {
      this.logger.error(`Lock release error:`, error);
    }
  }

  private logMetrics(): void {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate =
      total > 0 ? ((this.metrics.hits / total) * 100).toFixed(2) : '0';

    this.logger.log({
      message: 'Cache Metrics',
      metrics: {
        ...this.metrics,
        hitRate: `${hitRate}%`,
        total,
      },
    });
  }

  /**
   * Retorna métricas atuais
   */
  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    return {
      ...this.metrics,
      total,
      hitRate,
    };
  }

  /**
   * Reseta métricas
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      sets: 0,
      deletes: 0,
    };
  }
}
