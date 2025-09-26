import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator para marcar rotas como públicas (não requerem autenticação)
 */
export const isPublic = () => SetMetadata(IS_PUBLIC_KEY, true);
