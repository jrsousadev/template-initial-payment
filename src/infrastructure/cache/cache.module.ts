import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModule as NestCacheManager } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';
import Valkey from 'iovalkey';
import KeyvValkey from '@keyv/valkey';

@Global()
@Module({
  imports: [
    NestCacheManager.registerAsync({
      useFactory: async (configService: ConfigService) => {
        const instanceId = process.env.INSTANCE_ID || '0';
        console.log(`[Instance ${instanceId}] Connecting to Valkey...`);

        const valkey = new Valkey(process.env.REDIS_URL!, {
          lazyConnect: true,
          connectionName: `axis-core-instance-${instanceId}`,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        });

        await valkey.connect();
        console.log(`[Instance ${instanceId}] Valkey connected successfully`);

        return {
          stores: [new KeyvValkey(valkey)],
        };
      },
      inject: [ConfigService],
      isGlobal: true,
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
