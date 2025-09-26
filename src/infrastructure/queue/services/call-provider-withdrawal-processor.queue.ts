import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  company,
  provider,
  provider_name,
  queue,
  transaction_account_type,
  webhook,
  withdrawal,
} from '@prisma/client';
import { WebhookConstants } from 'src/common/constants/webhook.constants';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { snowflakeMid } from 'src/common/utils/snowflake-mid.util';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { WithdrawalResponse } from 'src/infrastructure/gateways/base-payment.provider';
import { GatewayProviderFactoryService } from 'src/infrastructure/gateways/gateway-provider-factory.service';
import { CreateTransactionData } from 'src/modules/transaction/interfaces/transaction.interfaces';
import { TransactionService } from 'src/modules/transaction/services/transaction.service';
import { WebhookSenderService } from 'src/modules/webhook-sender/webhook-sender.service';
import {
  QueueResultTaskFailed,
  QueueTask,
  QueueTasksCallProviderWithdrawalBatch,
  WalletWithTimestamp,
  typeMapWithdrawal,
} from '../interfaces/queue.interfaces';

@Injectable()
export class CallProviderWithdrawalProcessorQueue {
  private readonly logger = new Logger(
    CallProviderWithdrawalProcessorQueue.name,
  );
  private isShuttingDown = false;
  private instanceId = snowflakeMid;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: GatewayProviderFactoryService,
    private readonly transactionService: TransactionService,
    private readonly webhookSenderService: WebhookSenderService,
  ) {}

  // publics

  public stopAcceptingJobs(): void {
    const stack = new Error().stack;
    this.logger.error('🔴 [STOP ACCEPTING JOBS] Called from:', stack);
    this.isShuttingDown = true;
    this.logger.log('🛑 Parando de aceitar novos jobs');
  }

  public async loadPendingTasks({ batchSize = 1 }: { batchSize: number }) {
    if (this.isShuttingDown) {
      this.logger.warn('🔴 [SHUTTING DOWN] Not loading new tasks');
      return 0;
    }

    const tasks = await this.getTasksBatch(batchSize);

    if (tasks.length === 0) {
      return 0;
    }

    const callProviderWithdrawalsTasks = tasks.filter(
      (t) => t.type === 'CALL_PROVIDER_WITHDRAWAL',
    );

    if (callProviderWithdrawalsTasks.length > 0) {
      this.enqueueTask({
        id: `batch-withdrawal-${Date.now()}`,
        createdAt: new Date(),
        type: 'CALL_PROVIDER_WITHDRAWAL',
        payload: callProviderWithdrawalsTasks,
        attempt: 1,
      });
    }

    return tasks.length;
  }

  // privates

  private async createTransactionWallet({
    tx,
    sourceId,
    transactions,
  }: {
    tx: Prisma.TransactionClient;
    transactions: CreateTransactionData[];
    sourceId: string;
  }): Promise<{
    created: number;
    duplicates: number;
  }> {
    if (transactions.length === 0) {
      return { created: 0, duplicates: 0 };
    }

    try {
      const transactionsResult = await this.transactionService.createMany({
        tx,
        sourceId,
        transactions,
      });

      return {
        created: transactionsResult.created,
        duplicates: transactionsResult.duplicates,
      };
    } catch (error) {
      this.logger.error('Error creating transaction wallet:', error);
      throw error;
    }
  }

  private async getTasksBatch(batchSize: number): Promise<queue[]> {
    const tasks: queue[] = await this.prisma.$queryRaw<any>(Prisma.sql`
        WITH cte AS (
          SELECT *
          FROM "queue"
          WHERE
            status = 'PENDING'
            AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '2 minute')
            AND type = 'CALL_PROVIDER_WITHDRAWAL'
          ORDER BY created_at ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "queue"
        SET
          locked_at = NOW(),
          locked_by = ${this.instanceId}
        WHERE id IN (SELECT id FROM cte)
        RETURNING *;
      `);
    return tasks;
  }

  private async enqueueTask(task: QueueTask) {
    const startTime = task.createdAt;
    const startExec = Date.now();

    const batchTasksData = task.payload as Array<{
      id: string;
      payload: any;
    }>;

    try {
      await this.prisma.queue.updateMany({
        where: { id: { in: batchTasksData.map((t) => t.id) } },
        data: {
          status: 'IN_PROGRESS',
        },
      });

      let queueResultsFailed: QueueResultTaskFailed[] = [];
      let queueResultsSuccess: string[] = [];

      switch (task.type) {
        case 'CALL_PROVIDER_WITHDRAWAL':
          const callProviderWithdrawalsData: QueueTasksCallProviderWithdrawalBatch[] =
            batchTasksData.map((p) => ({
              queueId: p.id,
              payload: {
                pixKey: p.payload.pixKey,
                pixType: p.payload.pixType,
                receiverDocument: p.payload.receiverDocument,
                receiverType: p.payload.receiverType,
                type: p.payload.type,
                withdrawalId: p.payload.withdrawalId,
              },
            }));

          const withdrawalResults =
            await this.processCallProviderWithdrawalBatch(
              callProviderWithdrawalsData,
            );
          queueResultsFailed = withdrawalResults.queueResultsFailed;
          queueResultsSuccess = withdrawalResults.queueResultsSuccess;
          break;
      }

      const endTime = new Date();
      const timeElapsed = endTime.getTime() - startTime.getTime();
      const timeExec = Date.now() - startExec;

      const [] = await Promise.all([
        this.prisma.queue.updateMany({
          where: { id: { in: queueResultsSuccess } },
          data: {
            status: 'COMPLETED',
            time: timeElapsed,
            time_exec: timeExec,
            locked_at: null,
            locked_by: null,
          },
        }),
        this.prisma.queue.updateMany({
          where: {
            id: { in: queueResultsFailed.map((failed) => failed.taskId) },
          },
          data: {
            status: 'FAILED',
            time: timeElapsed,
            time_exec: timeExec,
            error: JSON.stringify(
              queueResultsFailed.map((failed) => ({
                taskId: failed.taskId,
                error: failed.error,
              })),
            ),
            locked_at: null,
            locked_by: null,
            attempt: { increment: 1 },
          },
        }),
      ]);

      this.logger.log(
        `queued ${task.type} - Success: ${queueResultsSuccess.length}, Failed: ${queueResultsFailed.length}`,
      );

      return;
    } catch (err) {
      this.logger.error(`Error processing task ${task.id}:`, err.message);

      const endTime = new Date();
      const timeElapsed = endTime.getTime() - startTime.getTime();
      const timeExec = Date.now() - startExec;

      await this.prisma.queue.updateMany({
        where: { id: { in: batchTasksData.map((t) => t.id) } },
        data: {
          status: 'FAILED',
          time: timeElapsed,
          time_exec: timeExec,
          locked_at: null,
          locked_by: null,
          attempt: { increment: 1 },
          error: JSON.stringify(err),
        },
      });

      throw err;
    }
  }

  // privates methods helpers

  private async updateCompanyWalletBalance(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    return await tx.$queryRawUnsafe(
      `SELECT * FROM update_company_wallet_balances($1)`,
      companyId,
    );
  }

  private async processMicroBatchWithBalanceProtection(
    tasks: QueueTasksCallProviderWithdrawalBatch[],
    companyId: string,
    queueResultsSuccess: string[],
    queueResultsFailed: QueueResultTaskFailed[],
  ) {
    const withdrawalsIds = tasks.map((t) => t.payload.withdrawalId);

    try {
      const validationTimeout = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`TIMEOUT: Validation exceeded 30s`)),
          30000,
        );
      });

      const processedWithdrawals = await Promise.race([
        this.validateAndDeductWithAtomicProtection(
          withdrawalsIds,
          companyId,
          tasks,
          queueResultsFailed,
        ),
        validationTimeout,
      ]);

      if (!processedWithdrawals || processedWithdrawals.length === 0) {
        return;
      }

      await this.processValidatedWithdrawals(
        processedWithdrawals,
        tasks,
        queueResultsSuccess,
        queueResultsFailed,
      );
    } catch (error) {
      if (error.message?.includes('TIMEOUT: Validation')) {
        tasks.forEach((task) => {
          if (task.queueId) {
            queueResultsFailed.push({
              taskId: task.queueId,
              error: 'Validation timeout before balance deduction',
            });
          }
        });
        return;
      }

      if (error.message?.includes('Negative balance detected')) {
        await this.prisma.withdrawal.updateMany({
          where: {
            id: { in: withdrawalsIds },
            status: 'PENDING',
            balance_deducted: false,
          },
          data: {
            status: 'FAILED',
            error_message:
              'Saldo insuficiente - validação em batch detectou saldo negativo',
            failed_at: new Date(),
          },
        });

        tasks.forEach((task) => {
          if (task.queueId) {
            queueResultsFailed.push({
              taskId: task.queueId,
              error: 'Insufficient balance - negative balance detected',
            });
          }
        });
      }

      throw error;
    }
  }

  private async validateAndDeductWithAtomicProtection(
    withdrawalsIds: string[],
    companyId: string,
    tasks: QueueTasksCallProviderWithdrawalBatch[],
    queueResultsFailed: QueueResultTaskFailed[],
  ): Promise<any[]> {
    const company = await this.prisma.company.findUnique({
      where: {
        id: companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        balance_blocked: true,
        signature_key_webhook: true,
      },
    });

    if (!company) {
      tasks.forEach((task) => {
        if (task.queueId) {
          queueResultsFailed.push({
            taskId: task.queueId,
            error: `Company ${companyId} not found`,
          });
        }
      });
      throw new Error(`Company ${companyId} not found`);
    }

    const infractions = await this.prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COALESCE(SUM(amount), 0)::int as total
      FROM infraction
      WHERE
        company_id = ${companyId}
        AND status NOT IN ('CLOSED', 'CANCELLED')
    `;

    const infractionsBlocked = infractions[0]?.total
      ? typeof infractions[0].total === 'bigint'
        ? Number(infractions[0].total)
        : infractions[0].total
      : 0;

    return await this.prisma.$transaction(
      async (tx) => {
        const workerId = this.instanceId;

        const withdrawals = await tx.$queryRaw<withdrawal[]>`
        SELECT * FROM withdrawal
          WHERE id = ANY(${withdrawalsIds})
            AND status = 'PENDING'
            AND balance_deducted = false
          FOR UPDATE SKIP LOCKED
      `;

        if (withdrawals.length === 0) {
          return [];
        }

        const obtainedIds = withdrawals.map((w) => w.id);
        const taskMap = new Map(tasks.map((t) => [t.payload.withdrawalId, t]));

        // Mark tasks for withdrawals that were not obtained as failed
        withdrawalsIds.forEach((wId) => {
          if (!obtainedIds.includes(wId)) {
            const task = taskMap.get(wId);
            if (task?.queueId) {
              queueResultsFailed.push({
                taskId: task.queueId,
                error: 'Withdrawal already processed or locked',
              });
            }
          }
        });

        await tx.$executeRaw`
        UPDATE withdrawal
        SET
          processing_attempts = processing_attempts + 1,
          last_processing_attempt_at = NOW(),
          processing_worker_id = ${workerId}
        WHERE id = ANY(${obtainedIds})
        `;

        const otherPendingWithdrawals = await tx.$queryRaw<{ total: number }>`
        SELECT
          COALESCE(SUM(total_amount), 0)::int as total
        FROM withdrawal
        WHERE
          company_id = ${companyId}
          AND status IN ('PENDING', 'PROCESSING')
          AND balance_deducted = true
          AND id NOT IN (${Prisma.join(withdrawalsIds)})
      `;

        const totalAmountWithdrawalsPending = otherPendingWithdrawals[0].total;

        const quickBalanceCheck = await tx.$queryRaw<{ total_balance: number }>`
        SELECT
          SUM(balance::int) as total_balance
        FROM wallet
        WHERE
          company_id = ${companyId}
          AND account_type IN ('BALANCE_AVAILABLE')
          AND currency = 'BRL'
      `;
        const totalCompanyBalance = quickBalanceCheck.total_balance;

        const totalWithdrawalsAmount = withdrawals.reduce((sum, w) => {
          const amount = w.total_amount || 0;
          return sum + amount;
        }, 0);

        const infractionsBlockedNum =
          typeof infractionsBlocked === 'bigint'
            ? Number(infractionsBlocked)
            : infractionsBlocked;

        const balanceAfterWithdrawal =
          totalCompanyBalance - totalWithdrawalsAmount - infractionsBlockedNum;
        const withdrawalPercentage =
          totalCompanyBalance > 0
            ? (totalWithdrawalsAmount / totalCompanyBalance) * 100
            : 100;

        const useRobustValidation =
          balanceAfterWithdrawal < 100000 ||
          withdrawalPercentage > 30 ||
          totalCompanyBalance < 500000;

        let lockedBalances: WalletWithTimestamp[];

        if (useRobustValidation) {
          try {
            lockedBalances = await tx.$queryRaw<WalletWithTimestamp[]>`
            SELECT
              account_type,
              balance::int as balance,
              last_updated,
              EXTRACT(EPOCH FROM (NOW() - last_updated)) as seconds_since_update
            FROM wallet
            WHERE
              company_id = ${companyId}
              AND account_type = 'BALANCE_AVAILABLE'
              AND currency = 'BRL'
            FOR UPDATE
          `;
          } catch (error) {
            if (error.code === '55P03') {
              tasks.forEach((task) => {
                if (task.queueId) {
                  queueResultsFailed.push({
                    taskId: task.queueId,
                    error: 'Balance temporarily locked, please retry',
                  });
                }
              });
              throw new Error('Balance temporarily locked, please retry');
            }
            throw error;
          }
        } else {
          lockedBalances = await tx.$queryRaw<WalletWithTimestamp[]>`
            SELECT
              account_type,
              balance::int as balance,
              last_updated,
              EXTRACT(EPOCH FROM (NOW() - last_updated)) as seconds_since_update
            FROM wallet
            WHERE
              company_id = ${companyId}
              AND account_type = 'BALANCE_AVAILABLE'
              AND currency = 'BRL'
          `;
        }

        const syncThreshold = useRobustValidation ? 60 : 300;
        const needsSync = lockedBalances.some(
          (row) => (row.seconds_since_update || 0) > syncThreshold,
        );

        if (needsSync) {
          await this.updateCompanyWalletBalance(tx, companyId);
          lockedBalances = await tx.$queryRaw<WalletWithTimestamp[]>`
          SELECT
            account_type,
            balance::int as balance
          FROM wallet
          WHERE
            company_id = ${companyId}
            AND account_type = 'BALANCE_AVAILABLE'
            AND currency = 'BRL'
        `;
        }

        const balanceMap = new Map<string, number>();

        lockedBalances.forEach((b) => {
          const balance =
            typeof b.balance === 'bigint' ? Number(b.balance) : b.balance;
          balanceMap.set('BALANCE_AVAILABLE', balance || 0);
        });

        const validWithdrawals: typeMapWithdrawal[] = [];
        const invalidWithdrawals: Array<any & { reason: string }> = [];

        const withdrawalsByType = new Map<string, typeMapWithdrawal[]>();
        withdrawalsByType.set('BALANCE_AVAILABLE', []);

        for (const w of withdrawals) {
          withdrawalsByType.get('BALANCE_AVAILABLE')!.push(w);
        }

        for (const [balanceType, typeWithdrawals] of withdrawalsByType) {
          const currentBalance = balanceMap.get('BALANCE_AVAILABLE') || 0;
          const adminBlock = company.balance_blocked || 0;

          const otherPending = totalAmountWithdrawalsPending;
          const totalBlocked =
            adminBlock + otherPending + infractionsBlockedNum;

          let availableBalance = currentBalance - totalBlocked;

          typeWithdrawals.sort(
            (a, b) => Number(a.total_amount) - Number(b.total_amount),
          );

          for (const withdrawal of typeWithdrawals) {
            withdrawal.companyName = company.name;
            withdrawal.companyEmail = company.email;
            withdrawal.companySignatureKeyWebhook =
              company.signature_key_webhook;
            withdrawal.infractionsBlockedAmount = infractionsBlockedNum;

            const withdrawalAmount =
              typeof withdrawal.total_amount === 'bigint'
                ? Number(withdrawal.total_amount)
                : withdrawal.total_amount;

            if (availableBalance >= withdrawalAmount) {
              validWithdrawals.push(withdrawal);
              availableBalance -= withdrawalAmount;
            } else {
              invalidWithdrawals.push({
                ...withdrawal,
                reason: `Saldo insuficiente: ${availableBalance} < ${withdrawalAmount}`,
              });

              // Add to failed queue results
              const task = taskMap.get(withdrawal.id);
              if (task?.queueId) {
                queueResultsFailed.push({
                  taskId: task.queueId,
                  error: `Insufficient balance: ${availableBalance} < ${withdrawalAmount}`,
                });
              }
            }
          }
        }

        if (validWithdrawals.length > 0) {
          const validIds = validWithdrawals.map((w) => w.id);

          await tx.$executeRaw`
          UPDATE withdrawal
          SET
            balance_deducted = true,
            updated_at = NOW()
          WHERE id = ANY(${validIds})
        `;

          const transactionsToCreate: CreateTransactionData[] =
            validWithdrawals.map((w) => ({
              id: UniqueIDGenerator.generate(),
              amount: -(typeof w.total_amount === 'bigint'
                ? Number(w.total_amount)
                : w.total_amount),
              amountFee: w.amount_fee,
              amountNet: -(typeof w.total_amount === 'bigint'
                ? Number(w.total_amount)
                : w.total_amount),
              accountType: 'BALANCE_AVAILABLE' as transaction_account_type,
              movementType: 'DEBIT' as const,
              operationType: 'WITHDRAWAL' as const,
              description: `Saque aprovado - ${w.id}`,
              sourceId: w.id,
              companyId: w.company_id,
              currency: 'BRL' as const,
              method: 'PIX',
              providerName: w.provider_name,
              webhookStatus: 'APPROVED',
            }));

          await this.createTransactionWallet({
            sourceId: UniqueIDGenerator.generate(),
            transactions: transactionsToCreate,
            tx,
          });
          await this.updateCompanyWalletBalance(tx, companyId);

          const finalBalanceCheck = await tx.$queryRaw<WalletWithTimestamp[]>`
          SELECT
            account_type,
            balance::int as balance
          FROM wallet
          WHERE
            company_id = ${companyId}
            AND account_type IN ('BALANCE_AVAILABLE')
            AND currency = 'BRL'
            AND balance < 0
        `;

          if (finalBalanceCheck.length > 0) {
            throw new Error(
              `CRITICAL: Negative balance detected after processing! ${JSON.stringify(finalBalanceCheck)}. Transaction will rollback.`,
            );
          }
        }

        if (invalidWithdrawals.length > 0) {
          await tx.$executeRaw`
          UPDATE withdrawal
          SET
            status = 'FAILED',
            error_message = 'Saldo insuficiente detectado na validação',
            failed_at = NOW()
          WHERE id = ANY(${invalidWithdrawals.map((w) => w.id)})
          `;
        }

        return validWithdrawals;
      },
      {
        timeout: 30000,
        isolationLevel: 'ReadCommitted',
      },
    );
  }

  private async processValidatedWithdrawals(
    withdrawals: typeMapWithdrawal[],
    tasks: QueueTasksCallProviderWithdrawalBatch[],
    queueResultsSuccess: string[],
    queueResultsFailed: QueueResultTaskFailed[],
  ) {
    if (withdrawals.length === 0) {
      return;
    }

    const taskMap = new Map(tasks.map((t: any) => [t.payload.withdrawalId, t]));
    const companyId = withdrawals[0].company_id;

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: {
        provider_cashout: true,
        webhooks: {
          where: {
            deleted_at: null,
            type: {
              in: ['WITHDRAWAL'],
            },
          },
        },
      },
    });

    const pLimit = (await import('p-limit')).default;
    const withdrawalLimit = pLimit(10);

    const approvedWithdrawals: Array<{
      withdrawal: typeMapWithdrawal;
      result: WithdrawalResponse;
      providerName: provider_name;
    }> = [];

    let processed = 0;
    let failed = 0;

    const promises = withdrawals.map((withdrawal, index) =>
      withdrawalLimit(async () => {
        const task = taskMap.get(withdrawal.id);
        if (!task) return;
        const callStart = Date.now();

        try {
          const processResult = await this.processWithdrawCall(
            withdrawal,
            task,
            company,
            queueResultsSuccess,
            queueResultsFailed,
          );
          if (!processResult) return;
          const { result, providerName } = processResult;

          if (result.status === 'APPROVED') {
            approvedWithdrawals.push({ withdrawal, result, providerName });
          }

          processed++;
        } catch (err: any) {
          const callTime = Date.now() - callStart;
          console.error(
            `[Withdrawal ${withdrawal.id} FAILED in ${callTime}ms:`,
            err.message,
          );
          failed++;

          if (task.queueId) {
            queueResultsFailed.push({
              taskId: task.queueId,
              error: err.message || 'Unknown error processing withdrawal',
            });
          }
        }
      }),
    );

    await Promise.allSettled(promises);

    if (approvedWithdrawals.length > 0) {
      await this.createWithdrawApprovedTasks(approvedWithdrawals);
    }
  }

  private async processWithdrawCall(
    withdrawal: typeMapWithdrawal,
    task: QueueTasksCallProviderWithdrawalBatch,
    company: company & {
      provider_cashout: provider | null;
      webhooks: webhook[];
    },
    queueResultsSuccess: string[],
    queueResultsFailed: QueueResultTaskFailed[],
  ): Promise<{
    result: WithdrawalResponse;
    providerName: provider_name;
  } | null> {
    let providerNameGlobal = 'UNKNOWN';

    try {
      const config = company.provider_cashout;

      if (!config) {
        if (task.queueId) {
          queueResultsFailed.push({
            taskId: task.queueId,
            error: `No provider configured for cashout for company ${company.id}`,
          });
        }
        throw new Error(
          `No provider configured for cashout for company ${company.id}`,
        );
      }

      const providerInfo =
        await this.providerFactory.createProviderInstance(config);
      const { providerInstance, providerName } = providerInfo;

      providerNameGlobal = providerName;

      const webhookUrl = `${WebhookConstants.WEBHOOK_BASE_URL}/${providerNameGlobal.toLowerCase()}`;

      const result = await providerInstance.createWithdrawal({
        myWithdrawalId: withdrawal.id,
        methodType: task.payload.receiverType,
        pixType: task.payload.pixType,
        pixKey: task.payload.pixKey,
        amount: withdrawal.amount,
        receiverDocument: task.payload.receiverDocument,
        webhookUrl,
      });

      await this.handleAcquirerResponse(withdrawal, result, providerName);

      // Add to success if processed successfully
      if (task.queueId) {
        queueResultsSuccess.push(task.queueId);
      }

      return { result, providerName };
    } catch (err: any) {
      console.error(`[ACQUIRER ERROR] ${withdrawal.id}:`);

      await this.handleWithdrawalError(
        withdrawal,
        err,
        providerNameGlobal,
        company,
      );

      if (task.queueId) {
        queueResultsFailed.push({
          taskId: task.queueId,
          error: err.message || 'Acquirer error',
        });
      }

      return null;
    }
  }

  private async handleAcquirerResponse(
    withdrawal: typeMapWithdrawal,
    result: WithdrawalResponse,
    providerName: provider_name,
  ): Promise<void> {
    await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        processing_at: new Date(),
        status: 'PROCESSING',
        provider_withdrawal_id: result.providerWithdrawalId,
        end_to_end_id: result.endToEndId,
        error_message: result.errorMessage,
        create_provider_response: result.providerResponse,
      },
    });

    if (result.status === 'FAILED') {
      const errorDetails = {
        message: result.errorMessage || 'Withdraw error from acquirer',
        providerResponse: result.providerResponse,
        status: result.status,
        withdrawId: result.providerWithdrawalId,
      };

      const error = new Error(JSON.stringify(errorDetails));
      (error as any).isAcquirerError = true;
      (error as any).details = errorDetails;
      throw error;
    }
  }

  private async handleWithdrawalError(
    withdrawal: typeMapWithdrawal,
    error: any,
    providerName: string,
    company: company & {
      provider_cashout: provider | null;
      webhooks: webhook[];
    },
  ): Promise<void> {
    let errorDetails: any = {
      ...error,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'FAILED',
          error_message: errorDetails.message,
          error_provider_response: errorDetails,
          failed_at: new Date(),
        },
      });

      await this.refundWithdrawalBalance(withdrawal, providerName);

      const webhookPromises = company.webhooks
        .filter((webhookConfig) => webhookConfig.type === 'WITHDRAWAL')
        .map((webhookConfig) =>
          this.webhookSenderService.createWebhooksLog([
            {
              type: 'WITHDRAWAL',
              withdrawal: {
                id: withdrawal.id,
                amount: withdrawal.amount,
                status: 'FAILED',
                end_to_end_id: withdrawal.end_to_end_id,
                company_id: withdrawal.company_id,
                external_id: withdrawal.external_id,
              },
              webhook: webhookConfig,
            },
          ]),
        );

      if (webhookPromises.length > 0) {
        const results = await Promise.allSettled(webhookPromises);

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Webhook ${index} falhou:`, result.reason);
          }
        });
      }
    } catch (errorHandlingError) {
      console.error(
        `[CRITICAL] Failed to handle withdraw error for ${withdrawal.id}:`,
        errorHandlingError,
      );

      try {
        await this.emergencyRefund(withdrawal, providerName);
      } catch (emergencyError) {
        console.error(
          `[EMERGENCY REFUND FAILED] ${withdrawal.id}:`,
          emergencyError,
        );
      }
    }
  }

  private async emergencyRefund(
    withdrawal: typeMapWithdrawal,
    providerName: string,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await this.createTransactionWallet({
            sourceId: withdrawal.id,
            transactions: [
              {
                amount: withdrawal.total_amount,
                amountFee: 0,
                amountNet: withdrawal.total_amount,
                accountType: 'BALANCE_AVAILABLE',
                movementType: 'CREDIT',
                operationType: 'REFUND_OUT',
                description: `EMERGENCY - Refund for failed withdraw ${withdrawal.id}`,
                sourceId: withdrawal.id,
                companyId: withdrawal.company_id,
                currency: 'BRL',
                method: 'PIX',
                webhookStatus: 'REFUNDED',
              },
            ],
            tx,
          });

          await tx.$executeRawUnsafe(
            `SELECT * FROM update_company_wallet_balances($1)`,
            withdrawal.company_id,
          );
        },
        {
          timeout: 5000,
          isolationLevel: 'ReadCommitted',
        },
      );
    } catch (err) {
      console.error(`[EMERGENCY REFUND ERROR] ${withdrawal.id}:`, err);
      throw err;
    }
  }

  private async refundWithdrawalBalance(
    withdrawal: typeMapWithdrawal,
    providerName: string,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        await this.createTransactionWallet({
          sourceId: withdrawal.id,
          transactions: [
            {
              amount: withdrawal.total_amount,
              amountFee: 0,
              amountNet: withdrawal.total_amount,
              accountType: 'BALANCE_AVAILABLE',
              movementType: 'CREDIT',
              operationType: 'REFUND_OUT',
              description: `Refund for failed withdraw ${withdrawal.id}`,
              sourceId: withdrawal.id,
              companyId: withdrawal.company_id,
              currency: 'BRL',
              method: 'PIX',
              webhookStatus: 'REFUNDED',
            },
          ],
          tx,
        });

        await tx.$executeRawUnsafe(
          `SELECT * FROM update_company_wallet_balances($1)`,
          withdrawal.company_id,
        );
      },
      {
        timeout: 10000,
        isolationLevel: 'ReadCommitted',
      },
    );
  }

  private async createWithdrawApprovedTasks(
    approvedWithdrawals: any[],
  ): Promise<void> {
    // Implementation for creating approved tasks
  }

  // methods

  async processCallProviderWithdrawalBatch(
    tasks: QueueTasksCallProviderWithdrawalBatch[],
  ): Promise<{
    queueResultsSuccess: string[];
    queueResultsFailed: QueueResultTaskFailed[];
  }> {
    const queueResultsSuccess: string[] = [];
    const queueResultsFailed: QueueResultTaskFailed[] = [];

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const batchStartTime = Date.now();

    try {
      const withdrawalsIds = [
        ...new Set(tasks.map((t) => t.payload.withdrawalId)),
      ];

      const allWithdrawals = await this.prisma.withdrawal.findMany({
        where: {
          id: { in: withdrawalsIds },
          status: 'PENDING',
        },
        select: {
          id: true,
          company_id: true,
          status: true,
        },
      });

      const withdrawalMap = new Map(allWithdrawals.map((w) => [w.id, w]));

      const companyGroups = new Map<string, any>();
      const processedIds = new Set<string>();

      for (const task of tasks) {
        if (processedIds.has(task.payload.withdrawalId)) continue;
        processedIds.add(task.payload.withdrawalId);

        const info = withdrawalMap.get(task.payload.withdrawalId);

        if (!info) {
          if (task.queueId) {
            queueResultsFailed.push({
              taskId: task.queueId,
              error: 'Withdrawal not found or not in PENDING status',
            });
          }
          continue;
        }

        if (!companyGroups.has(info.company_id)) {
          companyGroups.set(info.company_id, []);
        }

        companyGroups.get(info.company_id).push({
          ...info,
          queueId: task.queueId,
          payload: {
            pixKey: task.payload.pixKey,
            pixType: task.payload.pixType,
            receiverDocument: task.payload.receiverDocument,
            receiverType: task.payload.receiverType,
            withdrawalId: task.payload.withdrawalId,
          },
        });
      }

      const pLimit = (await import('p-limit')).default;
      const companyLimit = pLimit(2);

      let completedCompanies = 0;

      const companyPromises = Array.from(companyGroups.entries()).map(
        ([companyId, companyTasks]) =>
          companyLimit(async () => {
            const startCompanyTime = Date.now();

            try {
              const BATCH_SIZE = 30;
              const batchLimit = pLimit(1);
              const batches: any[][] = [];
              for (let i = 0; i < companyTasks.length; i += BATCH_SIZE) {
                batches.push(companyTasks.slice(i, i + BATCH_SIZE));
              }

              let completedBatches = 0;
              const batchPromises = batches.map((batch, index) =>
                batchLimit(async () => {
                  try {
                    await this.processMicroBatchWithBalanceProtection(
                      batch,
                      companyId,
                      queueResultsSuccess,
                      queueResultsFailed,
                    );
                    completedBatches++;
                  } catch (error) {
                    this.logger.error(
                      `Batch ${index + 1} failed for company ${companyId}:`,
                      error,
                    );

                    batch.forEach((task) => {
                      if (task.queueId) {
                        queueResultsFailed.push({
                          taskId: task.queueId,
                          error: error.message || 'Batch processing error',
                        });
                      }
                    });
                  }

                  if (index < batches.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                  }
                }),
              );

              await Promise.all(batchPromises);

              completedCompanies++;
            } catch (error) {
              const companyTime = Date.now() - startCompanyTime;
              console.error(
                `[BATCH ${batchId}][COMPANY ${companyId}] FATAL ERROR in ${companyTime}ms:`,
                error,
              );

              // Mark all tasks for this company as failed
              companyTasks.forEach((task) => {
                if (task.queueId) {
                  queueResultsFailed.push({
                    taskId: task.queueId,
                    error: error.message || 'Company processing error',
                  });
                }
              });

              throw error;
            }
          }),
      );

      await Promise.all(companyPromises);

      return {
        queueResultsSuccess,
        queueResultsFailed,
      };
    } catch (error) {
      const totalTime = Date.now() - batchStartTime;
      console.error(
        `[BATCH ${batchId}] ========== FATAL ERROR in ${totalTime}ms ==========`,
        error,
      );
      this.logger.error(
        'Fatal error in processCallProviderWithdrawalBatch:',
        error,
      );

      // Mark all remaining unprocessed tasks as failed
      tasks.forEach((task) => {
        if (
          task.queueId &&
          !queueResultsSuccess.includes(task.queueId) &&
          !queueResultsFailed.some((f) => f.taskId === task.queueId)
        ) {
          queueResultsFailed.push({
            taskId: task.queueId,
            error: 'Fatal batch processing error',
          });
        }
      });

      return {
        queueResultsSuccess,
        queueResultsFailed,
      };
    }
  }
}
