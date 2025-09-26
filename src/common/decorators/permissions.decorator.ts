// src/common/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions/permissions.enum';

export const PERMISSIONS_KEY = 'permissions';

// Decorator simples para marcar quais permissões são necessárias
export const RequirePermissions = (...permissions: Permission[]) => {
  if (permissions.length === 0) {
    throw new Error('At least one permission must be specified');
  }
  return SetMetadata(PERMISSIONS_KEY, permissions);
};

// Decorator para rotas públicas (opcional, mas útil)
export const Public = () => SetMetadata('isPublic', true);
