export interface CacheOptions {
  ttl?: number; // em segundos
  prefix?: string;
  skipCache?: boolean;
}

export interface CachedData<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}
