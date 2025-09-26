export enum Permission {
  READ_INFRACTIONS = 'read_infraction',
  READ_PAYMENT = 'read_payment',
  READ_WITHDRAWAL = 'read_withdrawal',
  READ_BALANCE = 'read_balance',

  WRITE_PAYMENT = 'write_payment',
  WRITE_WITHDRAWAL = 'write_withdrawal',
  WRITE_INFRACTION = 'write_infraction',

  REFUND_PAYMENT = 'refund_payment',
}

// Type para o objeto de permissões
export type PermissionSet = Record<Permission, boolean>;

// Helper para criar set de permissões vazio
export const createEmptyPermissionSet = (): PermissionSet => {
  return Object.values(Permission).reduce((acc, perm) => {
    acc[perm] = false;
    return acc;
  }, {} as PermissionSet);
};

// Helper para extrair permissões de qualquer objeto
export const extractPermissions = (source: any): PermissionSet => {
  const permissions = createEmptyPermissionSet();

  Object.values(Permission).forEach((perm) => {
    permissions[perm] = source[perm] === true;
  });

  return permissions;
};

// Helper para extrair permissões para formato do Prisma
export const extractPermissionsForPrisma = (
  source: any,
): Partial<Record<Permission, boolean>> => {
  const result: Partial<Record<Permission, boolean>> = {};

  Object.values(Permission).forEach((perm) => {
    if (source[perm] !== undefined) {
      result[perm] = source[perm] ?? false;
    }
  });

  return result;
};
