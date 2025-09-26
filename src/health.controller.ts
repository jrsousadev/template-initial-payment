import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { CacheService } from './infrastructure/cache/cache.service';
import { PrismaService } from './infrastructure/database/prisma.service';

@Controller()
export class HealthController {
  private isShuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {
    // Escuta sinal de shutdown
    process.on('SIGTERM', () => {
      this.isShuttingDown = true;
    });
  }

  private async checkRedis() {
    const testKey = `health:${Date.now()}`;
    await this.cacheService.set(testKey, 'test', 100);
    const result = await this.cacheService.get(testKey);
    await this.cacheService.del(testKey);
    if (!result) throw new Error('Redis failed');
  }

  @Get('/healthz')
  @ApiExcludeEndpoint()
  async getSimpleHealth() {
    if (this.isShuttingDown) {
      throw new HttpException('SHUTTING_DOWN', HttpStatus.SERVICE_UNAVAILABLE);
    }

    try {
      const healthCheckPromise = Promise.all([
        this.prisma.$queryRaw`SELECT 1`,

        this.checkRedis(),
      ]);

      await Promise.race([
        healthCheckPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check too slow')), 4000),
        ),
      ]);

      return 'OK';
    } catch (error) {
      throw new HttpException('UNHEALTHY', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  @Get('/debug-ip')
  debugIp(@Req() request: any) {
    return {
      // Headers do Cloudflare
      cloudflare: {
        'cf-connecting-ip': request.headers['cf-connecting-ip'],
        'cf-ipcountry': request.headers['cf-ipcountry'],
        'cf-ray': request.headers['cf-ray'],
        'true-client-ip': request.headers['true-client-ip'],
      },
      // Outros headers de IP
      outros: {
        'x-forwarded-for': request.headers['x-forwarded-for'],
        'x-real-ip': request.headers['x-real-ip'],
        'x-client-ip': request.headers['x-client-ip'],
      },
      // IP direto
      direto: {
        'request.ip': request.ip,
        socket: request.socket?.remoteAddress,
      },
      // User agent pra confirmar que é você
      'user-agent': request.headers['user-agent'],
    };
  }

  @Get('/ready')
  @ApiExcludeEndpoint()
  async readiness() {
    // Mesma lógica do healthz
    return this.getSimpleHealth();
  }

  @Get('/live')
  @ApiExcludeEndpoint()
  liveness() {
    // Liveness sempre retorna OK se o pod está vivo
    // Não verifica banco/redis, apenas se o processo está rodando
    if (this.isShuttingDown) {
      throw new HttpException('SHUTTING_DOWN', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return 'OK';
  }

  @Get('/health')
  @ApiExcludeEndpoint()
  async health() {
    // Endpoint específico para o healthcheck do docker-compose
    return this.getSimpleHealth();
  }
}
