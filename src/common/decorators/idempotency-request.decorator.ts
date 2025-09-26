// idempotency.decorator.ts
import {
  applyDecorators,
  BadRequestException,
  CallHandler,
  ConflictException,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CacheService } from 'src/infrastructure/cache/cache.service';

export const IDEMPOTENCY_OPTIONS = 'idempotency:options';

export interface IdempotencyOptions {
  ttl?: number; // TTL em segundos (padrão: 24 horas)
  headerName?: string; // Nome do header (padrão: 'idempotency-key')
}

// Interface para o valor armazenado no cache
interface CachedIdempotentResponse {
  status: 'processing' | 'completed';
  response?: any;
  timestamp: number;
}

// Interceptor de Idempotência
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly cacheService: CacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();

    // Obter opções do metadata
    const options: IdempotencyOptions =
      Reflect.getMetadata(IDEMPOTENCY_OPTIONS, context.getHandler()) || {};

    const {
      ttl = 86400, // 24 horas em segundos
      headerName = 'idempotency-key',
    } = options;

    // Obter a chave de idempotência do header
    const idempotencyKey = request.headers[headerName.toLowerCase()] as string;

    if (!idempotencyKey) {
      throw new BadRequestException(
        `Header ${headerName} é obrigatório para esta operação`,
      );
    }

    // Criar chave única para o cache baseada na rota e idempotency key
    const cacheKey = `idempotency:${request.method}:${request.url}:${idempotencyKey}`;

    try {
      // Verificar se já existe uma resposta em cache
      const cachedData =
        await this.cacheService.get<CachedIdempotentResponse>(cacheKey);

      if (cachedData) {
        if (cachedData.status === 'processing') {
          // Se ainda está processando, retornar erro 409 Conflict
          throw new ConflictException(
            'Requisição com esta chave de idempotência ainda está sendo processada',
          );
        }

        return of(cachedData.response);
      }

      // Marcar como processando
      await this.cacheService.set(
        cacheKey,
        {
          status: 'processing',
          timestamp: Date.now(),
        } as CachedIdempotentResponse,
        ttl * 1000, // Converter para milissegundos
      );

      // Executar o handler e armazenar o resultado
      return next.handle().pipe(
        tap(async (data) => {
          // Armazenar resposta completa no cache
          await this.cacheService.set(
            cacheKey,
            {
              status: 'completed',
              response: data,
              timestamp: Date.now(),
            } as CachedIdempotentResponse,
            ttl * 1000,
          );
        }),
        catchError(async (error) => {
          // Em caso de erro, remover do cache para permitir retry
          await this.cacheService.del(cacheKey);
          return throwError(() => error);
        }),
      );
    } catch (error) {
      // Se for ConflictException, relançar
      if (error instanceof ConflictException) {
        throw error;
      }
      // Para outros erros, logar e continuar sem idempotência
      console.error('Erro no processamento de idempotência:', error);
      return next.handle();
    }
  }
}

// Decorator principal
export function Idempotent(options: IdempotencyOptions = {}) {
  return applyDecorators(
    SetMetadata(IDEMPOTENCY_OPTIONS, options),
    UseInterceptors(IdempotencyInterceptor),
  );
}

// Decorator para obter a chave de idempotência no controller
export const IdempotencyKey = createParamDecorator(
  (data: string = 'idempotency-key', ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return request.headers[data.toLowerCase()];
  },
);
