import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { snowflakeMid } from 'src/common/utils/snowflake-mid.util';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../database/prisma.service';
import { CallProviderWithdrawalProcessorQueue } from '../queue/services/call-provider-withdrawal-processor.queue';

@Injectable()
export class WorkerCallProviderWithdrawalAndWallet implements OnModuleInit {
  private logger = new Logger(WorkerCallProviderWithdrawalAndWallet.name);
  private intervals: NodeJS.Timeout[] = [];

  private readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  private readonly isWorkerCallProviderWithdrawalAndWallet =
    process.env.IS_WORKER_CALL_PROVIDER_WITHDRAWAL_AND_WALLET ?? 'false';
  private readonly workerId = snowflakeMid;

  private readonly podName =
    process.env.HOSTNAME ||
    `pod-${process.pid}-${Math.random().toString(36).substring(7)}`;

  private activeProcessTask = 0;
  private maxActiveProcessTask = 1;
  private isCleaningOrphanedWithdraws = false;

  constructor(
    private readonly cacheService: CacheService,
    private readonly callProviderWithdrawalProcessorQueue: CallProviderWithdrawalProcessorQueue,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (this.nodeEnv !== 'production' && this.nodeEnv !== 'staging') {
      this.logger.warn(
        'WorkerBalanceWithdrawal is not enabled in this environment',
      );
      return;
    }

    if (this.isWorkerCallProviderWithdrawalAndWallet === 'true') {
      const startDelay = Math.random() * 3000;

      setTimeout(() => {
        this.intervals.push(
          setInterval(() => this.executeUpdateWalletWithLock(), 10000),
          setInterval(() => this.processCallProviderWithdraw(), 1000),
        );
        this.logger.log(
          `Worker ${this.workerId}: started with ${startDelay}ms delay`,
        );
      }, startDelay);
    }
  }

  onModuleDestroy() {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.logger.log(`[${this.podName}] All intervals cleared`);
  }

  async processCallProviderWithdraw() {
    if (this.activeProcessTask >= this.maxActiveProcessTask) return;

    this.activeProcessTask++;
    try {
      await this.callProviderWithdrawalProcessorQueue.loadPendingTasks({
        batchSize: 350,
      });
    } catch (error) {
      this.logger.error('Error processing withdraw queue:', error);
    } finally {
      this.activeProcessTask--;
    }
  }

  private async executeUpdateWalletWithLock(): Promise<void> {
    const EXECUTION_INTERVAL = 10000;
    const LAST_RUN_KEY = 'wallet:balance:last_execution';
    const LOCK_KEY = 'wallet:balance:executor';
    const LOCK_TTL = 5000;

    try {
      const lastRunStr = await this.cacheService.get<string>(LAST_RUN_KEY);
      const lastRun = lastRunStr ? parseInt(lastRunStr) : 0;
      const timeSinceLastRun = Date.now() - lastRun;

      if (timeSinceLastRun < EXECUTION_INTERVAL - 1000) {
        this.logger.debug(
          `[${this.podName}] Too soon - last run was ${Math.round(timeSinceLastRun / 1000)}s ago`,
        );
        return;
      }

      const myBid = `${this.podName}:${Date.now()}`;

      const currentExecutor = await this.cacheService.get<string>(LOCK_KEY);
      if (currentExecutor) {
        const executorPod = currentExecutor.split(':')[0];
        const executorTime = parseInt(currentExecutor.split(':')[1] || '0');

        if (Date.now() - executorTime < LOCK_TTL) {
          this.logger.debug(
            `[${this.podName}] Pod ${executorPod} is executing`,
          );
          return;
        }
      }

      await this.cacheService.set(LOCK_KEY, myBid, LOCK_TTL);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const winner = await this.cacheService.get<string>(LOCK_KEY);
      if (!winner || !winner.startsWith(this.podName)) {
        this.logger.debug(
          `[${this.podName}] Lost election to ${winner?.split(':')[0]}`,
        );
        return;
      }

      await this.cacheService.set(LAST_RUN_KEY, Date.now().toString(), 60000);

      this.logger.log(
        `[${this.podName}] ✅ Elected as leader, executing wallet balance update...`,
      );

      const startTime = Date.now();
      await this.updateRecentWalletBalances();
      const duration = Date.now() - startTime;

      this.logger.log(
        `[${this.podName}] ✅ Wallet update completed in ${duration}ms`,
      );

      await this.cacheService.del(LOCK_KEY);
    } catch (error) {
      this.logger.error(`[${this.podName}] ❌ Error in wallet update:`, error);

      try {
        const currentLock = await this.cacheService.get<string>(LOCK_KEY);
        if (currentLock && currentLock.startsWith(this.podName)) {
          await this.cacheService.del(LOCK_KEY);
        }
      } catch (cleanupError) {}
    }
  }

  async updateRecentWalletBalances() {
    try {
      const result = await this.prisma.$queryRaw<
        Array<{ accounts_updated: number; duration_ms: number }>
      >`SELECT * FROM update_recent_wallet_balances(24);`;

      if (result && result.length > 0) {
        this.logger.log(
          `[Wallet Balance - ${this.podName}] ${result[0].accounts_updated} accounts updated in ${result[0].duration_ms}ms`,
        );
      }
    } catch (error) {
      this.logger.error('[Wallet Balance] Recent update error:', error);
    }
  }
}
