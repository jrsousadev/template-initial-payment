export class CacheConstants {
  // TTLs em segundos
  static readonly DEFAULT_TTL = 300; // 5 minutos
  static readonly API_KEY_TTL = 300; // 5 minutos
  static readonly ENTITY_TTL = 300; // 5 minutos para company/provider
  static readonly WEBHOOK_TTL = 600; // 10 minutos
  static readonly BALANCE_TTL = 60; // 1 minuto
  static readonly SHORT_TTL = 30; // 30 segundos
  static readonly LONG_TTL = 3600; // 1 hora

  // Prefixes
  static readonly API_KEY_PREFIX = 'api_key';
  static readonly COMPANY_PREFIX = 'company';
  static readonly PROVIDER_PREFIX = 'provider';
  static readonly WEBHOOK_PREFIX = 'webhook';
  static readonly PAYMENT_PREFIX = 'payment';
  static readonly WITHDRAWAL_PREFIX = 'withdrawal';
  static readonly WALLET_PREFIX = 'wallet';
  static readonly LOCK_PREFIX = 'lock';

  // Limites
  static readonly MAX_BATCH_SIZE = 100;
  static readonly MAX_CACHE_SIZE = 10000;
}
