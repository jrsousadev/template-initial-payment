import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  infraction_status,
  Prisma,
  provider_name,
  queue,
} from '@prisma/client';
import { format } from 'date-fns';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { MoneyUtil } from 'src/common/utils/money.util';
import { snowflakeMid } from 'src/common/utils/snowflake-mid.util';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { DevolutionsToCreateData } from 'src/modules/devolution/interfaces/devolution.interfaces';
import { DevolutionService } from 'src/modules/devolution/services/devolution.service';
import { CreatePaymentReleaseScheduleData } from 'src/modules/payment-release-schedule/interfaces/payment-release-schedule.interfaces';
import { PaymentReleaseScheduleService } from 'src/modules/payment-release-schedule/services/payment-release-schedule.service';
import { Payment } from 'src/modules/payment/entities/payment.entity';
import {
  CreateTransactionData,
  CreateTransactionPaymentSchedulesData,
} from 'src/modules/transaction/interfaces/transaction.interfaces';
import { TransactionService } from 'src/modules/transaction/services/transaction.service';
import {
  CreateWebhookLogsParamsData,
  ICreateWebhookLogsParamsInfraction,
} from 'src/modules/webhook-sender/webhook-sender.interfaces';
import { WebhookSenderService } from 'src/modules/webhook-sender/webhook-sender.service';
import { Withdrawal } from 'src/modules/withdrawal/entities/withdrawal.entity';
import { PaymentApprovedHandlerQueue } from '../handlers/payment-approved.handler';
import { PaymentRefundedHandlerQueue } from '../handlers/payment-refunded.handler';
import { WithdrawalRefundedHandlerQueue } from '../handlers/withdrawal-refunded.handler';
import {
  AnticipationsUpdates,
  InfractionsUpdates,
  PaymentReleaseSchedulesByPaymentsIdsUpdates,
  PaymentReleaseSchedulesUpdates,
  PaymentsUpdates,
  QueueResultTaskFailed,
  QueueTask,
  QueueTasksAnticipationsProcessor,
  QueueTasksInfractionsProcessor,
  QueueTasksPaymentReleaseSchedulesProcessor,
  QueueTasksPaymentsProcessor,
  QueueTasksWithdrawalsProcessor,
  WithdrawalsUpdates,
} from '../interfaces/queue.interfaces';

@Injectable()
export class GeneralProcessorQueue implements OnModuleInit {
  private readonly logger = new Logger(GeneralProcessorQueue.name);
  private isShuttingDown = false;

  private isWorkerGeneral = process.env.IS_WORKER_GENERAL ?? 'false';
  private nodeEnv = process.env.NODE_ENV ?? 'development';
  private instanceId = snowflakeMid;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentApprovedHandler: PaymentApprovedHandlerQueue,
    private readonly paymentRefundedHandler: PaymentRefundedHandlerQueue,
    private readonly withdrawalRefundedHandler: WithdrawalRefundedHandlerQueue,
    private readonly transactionService: TransactionService,
    private readonly webhookSenderService: WebhookSenderService,
    private readonly devolutionService: DevolutionService,
    private readonly paymentReleaseScheduleService: PaymentReleaseScheduleService,
  ) {}

  // publics

  async onModuleInit() {
    if (
      this.nodeEnv === 'production' ||
      this.nodeEnv === 'staging' ||
      this.isWorkerGeneral === 'true'
    ) {
      await this.resetInProgressTasks();
    } else {
      this.logger.log('Skipping resetInProgressTasks in development mode');
    }
  }

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

    const paymentTasks = tasks.filter((t) => t.type === 'PAYMENT');
    const withdrawalTasks = tasks.filter((t) => t.type === 'WITHDRAWAL');
    const infractionTasks = tasks.filter((t) => t.type === 'INFRACTION');
    const paymentReleaseScheduleTasks = tasks.filter(
      (t) => t.type === 'SCHEDULED',
    );
    const anticipationTasks = tasks.filter((t) => t.type === 'ANTICIPATION');

    if (paymentTasks.length > 0) {
      this.enqueueTask({
        id: `batch-payment-${Date.now()}`,
        createdAt: new Date(),
        type: 'PAYMENT',
        payload: paymentTasks,
        attempt: 1,
      });
    }

    if (withdrawalTasks.length > 0) {
      this.enqueueTask({
        id: `batch-withdrawal-${Date.now()}`,
        createdAt: new Date(),
        type: 'WITHDRAWAL',
        payload: withdrawalTasks,
        attempt: 1,
      });
    }

    if (infractionTasks.length > 0) {
      this.enqueueTask({
        id: `batch-infraction-${Date.now()}`,
        createdAt: new Date(),
        type: 'INFRACTION',
        payload: infractionTasks,
        attempt: 1,
      });
    }

    if (paymentReleaseScheduleTasks.length > 0) {
      this.enqueueTask({
        id: `batch-payment-release-schedule-${Date.now()}`,
        createdAt: new Date(),
        type: 'SCHEDULED',
        payload: paymentReleaseScheduleTasks,
        attempt: 1,
      });
    }

    if (anticipationTasks.length > 0) {
      this.enqueueTask({
        id: `batch-anticipation-${Date.now()}`,
        createdAt: new Date(),
        type: 'ANTICIPATION',
        payload: anticipationTasks,
        attempt: 1,
      });
    }

    return tasks.length;
  }

  // privates

  private async handlePaymentsUpdates(
    updates: PaymentsUpdates[],
    tx: Prisma.TransactionClient,
  ) {
    const updatePromises = updates.map(({ paymentId, updateData }) =>
      tx.payment.update({
        where: { id: paymentId },
        data: updateData,
      }),
    );

    await Promise.all(updatePromises);
  }

  private async handlePaymentReleaseSchedulesUpdates(
    updates: PaymentReleaseSchedulesUpdates[],
    tx: Prisma.TransactionClient,
  ) {
    const updatePromises = updates.map(
      ({ paymentReleaseScheduleId, updateData }) =>
        tx.payment_release_schedule.update({
          where: { id: paymentReleaseScheduleId },
          data: updateData,
        }),
    );

    await Promise.all(updatePromises);
  }

  private async handlePaymentReleaseSchedulesByPaymentsIdsUpdates(
    updates: PaymentReleaseSchedulesByPaymentsIdsUpdates[],
    tx: Prisma.TransactionClient,
  ) {
    const updatePromises = updates.map(({ paymentId, type, updateData }) =>
      tx.payment_release_schedule.updateMany({
        where: { payment_id: paymentId, status: 'SCHEDULED', type },
        data: updateData,
      }),
    );

    await Promise.all(updatePromises);
  }

  private async handleWithdrawalsUpdates(
    updates: WithdrawalsUpdates[],
    tx: Prisma.TransactionClient,
  ) {
    const updatePromises = updates.map(({ withdrawalId, updateData }) =>
      tx.withdrawal.update({
        where: { id: withdrawalId },
        data: updateData,
      }),
    );

    await Promise.all(updatePromises);
  }

  private async handleAnticipationsUpdates(
    updates: AnticipationsUpdates[],
    tx: Prisma.TransactionClient,
  ) {
    const updatePromises = updates.map(({ anticipationId, updateData }) =>
      tx.anticipation.update({
        where: { id: anticipationId },
        data: updateData,
      }),
    );

    await Promise.all(updatePromises);
  }

  private async handleInfractionsUpdates(
    updates: InfractionsUpdates[],
    tx: Prisma.TransactionClient,
  ) {
    // Agrupar updates por campos similares para batch update
    const groupedUpdates = new Map<
      string,
      { ids: string[]; data: Prisma.infractionUpdateArgs['data'] }
    >();

    for (const update of updates) {
      const key = JSON.stringify(update.updateData);
      if (!groupedUpdates.has(key)) {
        groupedUpdates.set(key, { ids: [], data: update.updateData });
      }
      groupedUpdates.get(key)!.ids.push(update.infractionId);
    }

    // Executar updates em batch
    const updatePromises = Array.from(groupedUpdates.values()).map((group) =>
      tx.infraction.updateMany({
        where: { id: { in: group.ids } },
        data: group.data,
      }),
    );

    await Promise.all(updatePromises);
  }

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

  private async resetInProgressTasks() {
    if (this.isWorkerGeneral === 'true') {
      await this.prisma.queue.updateMany({
        where: {
          OR: [
            {
              status: 'IN_PROGRESS',
              locked_at: { lt: new Date(new Date().getTime() - 60 * 2000) },
              type: {
                not: 'CALL_PROVIDER_WITHDRAWAL',
              },
            },
            {
              status: 'PENDING',
              locked_at: { not: null },
              locked_by: { not: null },
              type: { not: 'CALL_PROVIDER_WITHDRAWAL' },
            },
          ],
        },
        data: {
          status: 'PENDING',
          locked_at: null,
          locked_by: null,
        },
      });
      this.logger.log('Reset IN_PROGRESS tasks to PENDING');
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
          AND type != 'CALL_PROVIDER_WITHDRAWAL'
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
        case 'PAYMENT':
          const paymentsBatchData: QueueTasksPaymentsProcessor[] =
            batchTasksData.map((p) => ({
              providerPaymentId: p.payload.providerPaymentId,
              endToEndId: p.payload.endToEndId,
              webhookStatus: p.payload.webhookStatus,
              providerResponse: p.payload.providerResponse,
              queueTaskId: p.id,
            }));

          const paymentResults = await this.processPayment(paymentsBatchData);
          queueResultsFailed = paymentResults.queueResultsFailed;
          queueResultsSuccess = paymentResults.queueResultsSuccess;
          break;
        case 'WITHDRAWAL':
          const withdrawalsBatchData: QueueTasksWithdrawalsProcessor[] =
            batchTasksData.map((p) => ({
              providerResponse: p.payload.providerResponse,
              providerWithdrawalId: p.payload.providerWithdrawalId,
              queueTaskId: p.id,
              webhookStatus: p.payload.webhookStatus,
              amount: p.payload.amount,
              endToEndId: p.payload.endToEndId,
              errorMessage: p.payload.errorMessage,
            }));

          const withdrawalResults =
            await this.processWithdrawal(withdrawalsBatchData);
          queueResultsFailed = withdrawalResults.queueResultsFailed;
          queueResultsSuccess = withdrawalResults.queueResultsSuccess;
          break;
        case 'INFRACTION':
          const infractionsBatchData: QueueTasksInfractionsProcessor[] =
            batchTasksData.map((p) => ({
              analysisResult: p.payload.analysisResult,
              analysisReason: p.payload.analysisReason,
              providerInfractionId: p.payload.providerInfractionId,
              providerName: p.payload.providerName as provider_name,
              providerPaymentId: p.payload.providerPaymentId,
              providerResponse: p.payload.providerResponse,
              queueTaskId: p.id,
              reason: p.payload.reason,
              statusInfraction: p.payload.statusInfraction as infraction_status,
              webhookStatus: p.payload.webhookStatus,
              endToEndId: p.payload.endToEndId,
            }));

          const infractionResults =
            await this.processInfraction(infractionsBatchData);
          queueResultsFailed = infractionResults.queueResultsFailed;
          queueResultsSuccess = infractionResults.queueResultsSuccess;
          break;
        case 'SCHEDULED':
          const paymentReleaseScheduledBatchData: QueueTasksPaymentReleaseSchedulesProcessor[] =
            batchTasksData.map((p) => ({
              paymentReleaseScheduleId: p.payload.paymentReleaseScheduleId,
              queueTaskId: p.id,
            }));

          const paymentReleaseScheduleResults =
            await this.processPaymentReleaseSchedule(
              paymentReleaseScheduledBatchData,
            );

          queueResultsFailed = paymentReleaseScheduleResults.queueResultsFailed;
          queueResultsSuccess =
            paymentReleaseScheduleResults.queueResultsSuccess;
          break;
        case 'ANTICIPATION':
          const anticipationBatchData: QueueTasksAnticipationsProcessor[] =
            batchTasksData.map((p) => ({
              anticipationId: p.payload.anticipationId,
              queueTaskId: p.id,
            }));

          const processPaymentResults = await this.processAnticipation(
            anticipationBatchData,
          );

          queueResultsFailed = processPaymentResults.queueResultsFailed;
          queueResultsSuccess = processPaymentResults.queueResultsSuccess;
          break;
      }

      const endTime = new Date();
      const timeElapsed = endTime.getTime() - startTime.getTime();
      const timeExec = Date.now() - startExec;

      await Promise.all([
        this.prisma.queue.updateMany({
          where: { id: { in: queueResultsSuccess.map((taskId) => taskId) } },
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
              queueResultsFailed.find(
                (failed) => failed.taskId === failed.taskId,
              )?.error,
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

  // methods

  async processPayment(tasks: QueueTasksPaymentsProcessor[]) {
    const startTime = Date.now();
    const providerPaymentsIds = tasks.map((prov) => prov.providerPaymentId);

    if (this.nodeEnv !== 'production') {
      console.log({
        'type - webhook': 'PAYMENT',
        mode: 'BATCH',
        count: tasks.length,
        'data - webhook': format(new Date(), 'dd-MM-yyyy HH:mm:ss'),
      });
    }

    // (TO DO) vale a pena cachear?
    const payments = await this.prisma.payment.findMany({
      where: {
        provider_payment_id: { in: providerPaymentsIds },
      },
      include: {
        company: {
          include: {
            company_tax_configs: true,
            webhooks: {
              where: {
                deleted_at: null,
                type: {
                  in: ['REFUND_IN', 'PAYMENT', 'CHARGEBACK'],
                },
              },
            },
          },
        },
        provider: {
          include: {
            provider_tax_config: true,
          },
        },
      },
    });

    const paymentsMap = new Map(
      payments.map((p) => [p.provider_payment_id, p]),
    );

    const queueResultsFailed: QueueResultTaskFailed[] = [];
    const queueResultsSuccess: string[] = [];
    const webhooksBuildSender: CreateWebhookLogsParamsData[] = [];

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const paymentsUpdates: PaymentsUpdates[] = [];
          const devolutionsToCreate: DevolutionsToCreateData[] = [];
          const infractionsToCheck: string[] = [];
          const transactionsToCreate: CreateTransactionData[] = [];
          const schedulesUpdates: PaymentReleaseSchedulesByPaymentsIdsUpdates[] =
            [];
          const paymentsReleaseScheduleToCreate: CreatePaymentReleaseScheduleData[] =
            [];

          for (const task of tasks) {
            const payment = paymentsMap.get(task.providerPaymentId);
            if (!payment) {
              queueResultsFailed.push({
                error: 'Payment not found',
                taskId: task.queueTaskId,
              });
              continue;
            }

            if (!payment.provider.provider_tax_config) {
              queueResultsFailed.push({
                error: 'Provider tax config not found',
                taskId: task.queueTaskId,
              });
              continue;
            }

            const webhookStatus = task.webhookStatus;

            if (!webhookStatus) {
              queueResultsFailed.push({
                error: 'Webhook status not provided',
                taskId: task.queueTaskId,
              });
              continue;
            }

            const paymentEntity = new Payment(payment);

            if (webhookStatus === 'APPROVED' && paymentEntity.canApprove()) {
              console.log('Aprovando pagamento:', paymentEntity.id);
              await this.paymentApprovedHandler.execute({
                queueResultsSuccess,
                paymentsUpdates,
                task,
                transactionsToCreate,
                payment,
                paymentsReleaseScheduleToCreate,
              });

              if (payment.company.webhooks.length > 0) {
                const paymentWebhooks = payment.company.webhooks
                  .filter((webhook) => webhook.type === 'PAYMENT')
                  .map((webhook) => ({
                    type: 'PAYMENT' as const,
                    payment: {
                      id: payment.id,
                      amount: payment.amount,
                      company_id: payment.company_id,
                      end_to_end_id: task.endToEndId || null,
                      external_id: payment.external_id || null,
                      customer_document: payment.customer_document,
                      customer_name: payment.customer_name,
                      status: webhookStatus,
                      customer_email: payment.customer_email,
                      customer_phone: payment.customer_phone,
                    },
                    webhook,
                  }));

                webhooksBuildSender.push(...paymentWebhooks);
              }
            }

            if (webhookStatus === 'REFUNDED' && paymentEntity.canRefund()) {
              console.log('Reembolsando pagamento:', paymentEntity.id);
              await this.paymentRefundedHandler.execute({
                queueResultsSuccess,
                paymentsUpdates,
                task,
                transactionsToCreate,
                payment,
                devolutionsToCreate,
                infractionsToCheck,
                schedulesUpdates,
              });

              if (payment.company.webhooks.length > 0) {
                const paymentWebhooks = payment.company.webhooks
                  .filter((webhook) => webhook.type === 'PAYMENT')
                  .map((webhook) => ({
                    type: 'PAYMENT' as const,
                    payment: {
                      id: payment.id,
                      amount: payment.amount,
                      company_id: payment.company_id,
                      end_to_end_id: task.endToEndId || null,
                      external_id: payment.external_id || null,
                      customer_document: payment.customer_document,
                      customer_name: payment.customer_name,
                      status: webhookStatus,
                      customer_email: payment.customer_email,
                      customer_phone: payment.customer_phone,
                    },
                    webhook,
                  }));

                webhooksBuildSender.push(...paymentWebhooks);
              }
            }
          }

          if (devolutionsToCreate.length > 0) {
            await this.devolutionService.createMany(devolutionsToCreate);
          }

          if (paymentsUpdates.length > 0) {
            await this.handlePaymentsUpdates(paymentsUpdates, tx);
          }

          if (transactionsToCreate.length > 0) {
            await this.createTransactionWallet({
              tx,
              sourceId: UniqueIDGenerator.generate(),
              transactions: transactionsToCreate,
            });
          }

          if (infractionsToCheck.length > 0) {
            const infractions = await tx.infraction.findMany({
              where: {
                provider_payment_id: { in: infractionsToCheck },
                status: {
                  notIn: ['CLOSED', 'CANCELLED'],
                },
                analysis_reason: null,
              },
              select: {
                id: true,
              },
            });

            if (infractions.length > 0) {
              await tx.infraction.updateMany({
                where: { id: { in: infractions.map((i) => i.id) } },
                data: {
                  status: 'CLOSED',
                  closed_at: new Date(),
                  responsed_at: new Date(),
                  analysis_reason: 'AGREED',
                },
              });
            }
          }

          if (schedulesUpdates.length > 0) {
            await this.handlePaymentReleaseSchedulesByPaymentsIdsUpdates(
              schedulesUpdates,
              tx,
            );
          }

          if (paymentsReleaseScheduleToCreate.length > 0) {
            await this.paymentReleaseScheduleService.createSchedulesForPayment(
              paymentsReleaseScheduleToCreate,
              tx,
            );
          }
        },
        {
          maxWait: 20000,
          timeout: 60000,
        },
      );

      if (webhooksBuildSender.length > 0) {
        await this.webhookSenderService.createWebhooksLog(webhooksBuildSender);
      }

      return {
        queueResultsSuccess,
        queueResultsFailed,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(
        `[BATCH-${tasks.length}] Error processing after ${totalTime}ms:`,
        error,
      );
      throw error;
    }
  }

  async processWithdrawal(tasks: QueueTasksWithdrawalsProcessor[]) {
    const startTime = Date.now();
    const now = new Date();

    if (this.nodeEnv !== 'production') {
      console.log({
        'type - webhook': 'WITHDRAWAL',
        mode: 'BATCH',
        count: tasks.length,
        'data - webhook': format(new Date(), 'dd-MM-yyyy HH:mm:ss'),
      });
    }

    const providerWithdrawalIds = tasks.map((d) => d.providerWithdrawalId);

    // (TO DO) vale a pena cachear?
    const withdrawals = await this.prisma.withdrawal.findMany({
      where: {
        provider_withdrawal_id: { in: providerWithdrawalIds },
      },
      include: {
        company: {
          include: {
            company_tax_configs: true,
            webhooks: {
              where: {
                deleted_at: null,
                type: {
                  in: ['REFUND_OUT', 'WITHDRAWAL'],
                },
              },
            },
          },
        },
        provider: {
          include: {
            provider_tax_config: true,
          },
        },
      },
    });

    const withdrawalsMap = new Map(
      withdrawals.map((w) => [w.provider_withdrawal_id, w]),
    );

    const queueResultsFailed: QueueResultTaskFailed[] = [];
    const queueResultsSuccess: string[] = [];
    const webhooksBuildSender: CreateWebhookLogsParamsData[] = [];
    const transactionsToCreate: CreateTransactionData[] = [];

    try {
      await this.prisma.$transaction(async (tx) => {
        const withdrawalsUpdates: WithdrawalsUpdates[] = [];
        const devolutionsToCreate: DevolutionsToCreateData[] = [];

        for (const task of tasks) {
          const withdrawal = withdrawalsMap.get(task.providerWithdrawalId);
          if (!withdrawal) {
            queueResultsFailed.push({
              error: 'Withdrawal not found',
              taskId: task.queueTaskId,
            });
            continue;
          }

          if (!withdrawal.provider.provider_tax_config) {
            queueResultsFailed.push({
              error: 'Provider tax config not found',
              taskId: task.queueTaskId,
            });
            continue;
          }

          const webhookStatus = task.webhookStatus;

          if (!webhookStatus) {
            queueResultsFailed.push({
              error: 'Webhook status not found',
              taskId: task.queueTaskId,
            });
            continue;
          }

          const withdrawalEntity = new Withdrawal(withdrawal);

          if (webhookStatus === 'APPROVED' && withdrawalEntity.canApprove()) {
            withdrawalsUpdates.push({
              withdrawalId: withdrawal.id,
              updateData: {
                approved_at: now,
                status: 'APPROVED',
                ...(task.endToEndId && { end_to_end_id: task.endToEndId }),
              },
            });

            if (withdrawal.company.webhooks.length > 0) {
              const refundOutWebhooks = withdrawal.company.webhooks
                .filter((webhook) => webhook.type === 'REFUND_OUT')
                .map((webhook) => ({
                  type: 'REFUND_OUT' as const,
                  withdrawal: {
                    id: withdrawal.id,
                    amount: withdrawal.amount,
                    company_id: withdrawal.company_id,
                    end_to_end_id: task.endToEndId || null,
                    external_id: withdrawal.external_id || null,
                    status: webhookStatus,
                  },
                  webhook,
                }));
              webhooksBuildSender.push(...refundOutWebhooks);
            }
          }

          if (webhookStatus === 'REFUNDED' && withdrawalEntity.canRefund()) {
            await this.withdrawalRefundedHandler.execute({
              withdrawal,
              queueResultsFailed,
              task,
              transactionsToCreate,
              withdrawalsUpdates,
              devolutionsToCreate,
            });

            if (withdrawal.company.webhooks.length > 0) {
              const refundOutWebhooks = withdrawal.company.webhooks
                .filter((webhook) => webhook.type === 'REFUND_OUT')
                .map((webhook) => ({
                  type: 'REFUND_OUT' as const,
                  withdrawal: {
                    id: withdrawal.id,
                    amount: withdrawal.amount,
                    company_id: withdrawal.company_id,
                    end_to_end_id: task.endToEndId || null,
                    external_id: withdrawal.external_id || null,
                    status: webhookStatus,
                  },
                  webhook,
                }));

              webhooksBuildSender.push(...refundOutWebhooks);
            }
          }

          if (webhookStatus === 'FAILED' && withdrawalEntity.canFail()) {
            withdrawalsUpdates.push({
              withdrawalId: withdrawal.id,
              updateData: {
                failed_at: now,
                status: 'FAILED',
                error_message: task.errorMessage || null,
              },
            });

            transactionsToCreate.push({
              amount: withdrawal.total_amount,
              amountFee: 0,
              amountNet: withdrawal.total_amount,
              accountType: 'BALANCE_AVAILABLE',
              movementType: 'CREDIT',
              operationType: 'REFUND_OUT',
              companyId: withdrawal.company_id,
              description: `Reembolso de saque ${withdrawal.id}`,
              currency: 'BRL',
              method: 'PIX',
              sourceId: withdrawal.id,
              webhookStatus: 'FAILED',
            });

            if (withdrawal.company.webhooks.length > 0) {
              const withdrawalWebhooks = withdrawal.company.webhooks
                .filter((webhook) => webhook.type === 'WITHDRAWAL')
                .map((webhook) => ({
                  type: 'WITHDRAWAL' as const,
                  withdrawal: {
                    id: withdrawal.id,
                    amount: withdrawal.amount,
                    company_id: withdrawal.company_id,
                    end_to_end_id: task.endToEndId || null,
                    external_id: withdrawal.external_id || null,
                    status: webhookStatus,
                  },
                  webhook,
                }));

              webhooksBuildSender.push(...withdrawalWebhooks);
            }
          }

          queueResultsSuccess.push(task.queueTaskId);
        }

        if (devolutionsToCreate.length > 0) {
          await this.devolutionService.createMany(devolutionsToCreate);
        }

        if (withdrawalsUpdates.length > 0) {
          await this.handleWithdrawalsUpdates(withdrawalsUpdates, tx);
        }

        if (transactionsToCreate.length > 0) {
          await this.createTransactionWallet({
            tx,
            sourceId: UniqueIDGenerator.generate(),
            transactions: transactionsToCreate,
          });
        }
      });

      if (webhooksBuildSender.length > 0) {
        await this.webhookSenderService.createWebhooksLog(webhooksBuildSender);
      }

      return {
        queueResultsSuccess,
        queueResultsFailed,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(
        `[BATCH-${tasks.length}] Error processing after ${totalTime}ms:`,
        error,
      );
      throw error;
    }
  }

  async processInfraction(tasks: QueueTasksInfractionsProcessor[]) {
    const startTime = Date.now();
    const now = new Date();

    if (this.nodeEnv !== 'production') {
      console.log({
        'type - webhook': 'INFRACTION',
        mode: 'BATCH',
        count: tasks.length,
        'data - webhook': format(now, 'dd-MM-yyyy HH:mm:ss'),
      });
    }

    // 1. Buscar todos os dados necessários de uma vez
    const providerInfractionIds = tasks.map((d) => d.providerInfractionId);
    const paymentIdentifiers = tasks.map((t) => ({
      provider_payment_id: t.providerPaymentId,
      provider_name: t.providerName,
    }));

    // Busca paralela de infractions e payments
    const [infractions, payments] = await Promise.all([
      this.prisma.infraction.findMany({
        where: {
          provider_infraction_id: { in: providerInfractionIds },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          OR: paymentIdentifiers.map((p) => ({
            provider_payment_id: p.provider_payment_id,
            provider_name: p.provider_name,
          })),
        },
        select: {
          id: true,
          amount: true,
          method: true,
          provider_id: true,
          company_id: true,
          provider_payment_id: true,
          provider_name: true,
          company: {
            select: {
              webhooks: {
                where: {
                  deleted_at: null,
                  type: 'INFRACTION',
                },
              },
            },
          },
        },
      }),
    ]);

    // 2. Criar mapas para acesso rápido
    const infractionsMap = new Map(
      infractions.map((i) => [i.provider_infraction_id, i]),
    );

    const paymentsMap = new Map(
      payments.map((p) => [`${p.provider_payment_id}_${p.provider_name}`, p]),
    );

    const queueResultsFailed: QueueResultTaskFailed[] = [];
    const queueResultsSuccess: string[] = [];
    const webhooksBuildSender: CreateWebhookLogsParamsData[] = [];

    // 3. Preparar dados antes da transação
    const infractionsToCreate: any[] = [];
    const infractionsUpdates: InfractionsUpdates[] = [];
    const tasksToProcess: Array<{
      task: (typeof tasks)[0];
      payment: (typeof payments)[0];
      infraction?: (typeof infractions)[0];
    }> = [];

    // Pre-processar tasks
    for (const task of tasks) {
      const paymentKey = `${task.providerPaymentId}_${task.providerName}`;
      const payment = paymentsMap.get(paymentKey);

      if (!payment) {
        queueResultsFailed.push({
          error: 'Payment not found for infraction',
          taskId: task.queueTaskId,
        });
        continue;
      }

      const infraction = infractionsMap.get(task.providerInfractionId);
      tasksToProcess.push({ task, payment, infraction });
    }

    // 4. Definir helpers para status
    const infractionStatusClosed: infraction_status[] = ['CLOSED', 'CANCELLED'];
    const infractionStatusInDispute: infraction_status[] = [
      'AWAITING_COMPANY_RESPONSE',
      'UNDER_REVIEW',
    ];

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const { task, payment, infraction } of tasksToProcess) {
          if (!infraction) {
            // Preparar dados para criação em batch
            const newInfraction = {
              amount: payment.amount,
              payment_method: payment.method,
              provider_infraction_id: task.providerInfractionId,
              provider_payment_id: task.providerPaymentId,
              reason: task.reason,
              provider_id: payment.provider_id,
              company_id: payment.company_id,
              payment_id: payment.id,
              type: payment.method === 'CREDIT_CARD' ? 'CHARGEBACK' : 'MED',
              analysis_reason: task.analysisReason || null,
              analysis_result: task.analysisResult,
              status: task.statusInfraction,
              closed_at: task.statusInfraction === 'CLOSED' ? now : null,
              cancelled_at: task.statusInfraction === 'CANCELLED' ? now : null,
              defended_at: null,
              responsed_at: task.analysisResult ? now : null,
            };

            infractionsToCreate.push(newInfraction);
          } else {
            if (!task.analysisResult && task.statusInfraction !== 'CANCELLED') {
              queueResultsFailed.push({
                error: 'Analysis result is required for existing infraction',
                taskId: task.queueTaskId,
              });
              continue;
            }

            if (infractionStatusClosed.includes(task.statusInfraction)) {
              infractionsUpdates.push({
                infractionId: infraction.id,
                updateData: {
                  status: task.statusInfraction,
                  analysis_result: task.analysisResult,
                  analysis_reason: task.analysisReason || null,
                  closed_at: task.statusInfraction === 'CLOSED' ? now : null,
                  cancelled_at:
                    task.statusInfraction === 'CANCELLED' ? now : null,
                  responsed_at: task.analysisResult ? now : null,
                },
              });
            } else if (
              infractionStatusInDispute.includes(task.statusInfraction)
            ) {
              infractionsUpdates.push({
                infractionId: infraction.id,
                updateData: {
                  status: task.statusInfraction,
                  analysis_result: task.analysisResult || null,
                  analysis_reason: task.analysisReason || null,
                  reason: task.reason,
                },
              });
            }
          }

          queueResultsSuccess.push(task.queueTaskId);
        }

        let createdInfractions: any[] = [];
        if (infractionsToCreate.length > 0) {
          await tx.infraction.createMany({
            data: infractionsToCreate,
            skipDuplicates: true,
          });

          createdInfractions = await tx.infraction.findMany({
            where: {
              provider_infraction_id: {
                in: infractionsToCreate.map((i) => i.provider_infraction_id),
              },
            },
          });
        }

        if (infractionsUpdates.length > 0) {
          await this.handleInfractionsUpdates(infractionsUpdates, tx);
        }

        for (const { task, payment, infraction } of tasksToProcess) {
          if (payment.company.webhooks.length === 0) continue;

          let infractionData = infraction;
          if (!infractionData) {
            infractionData = createdInfractions.find(
              (i) => i.provider_infraction_id === task.providerInfractionId,
            );
          }

          if (!infractionData) continue;

          const infractionWebhooks: ICreateWebhookLogsParamsInfraction[] =
            payment.company.webhooks.map((webhook) => ({
              type: 'INFRACTION' as const,
              infraction: {
                id: infractionData.id,
                analysis_result: infractionData.analysis_result,
                analysis_reason: infractionData.analysis_reason,
                company_id: infractionData.company_id,
                reason: infractionData.reason,
                status: infractionData.status,
                responsed_at: infractionData.responsed_at,
                closed_at: infractionData.closed_at,
                defended_at: infractionData.defended_at,
                created_at: infractionData.created_at,
                cancelled_at: infractionData.cancelled_at,
                payment_id: infractionData.payment_id,
              },
              webhook,
            }));

          webhooksBuildSender.push(...infractionWebhooks);
        }
      });

      // 7. Enviar webhooks em batch após transação
      if (webhooksBuildSender.length > 0) {
        await this.webhookSenderService.createWebhooksLog(webhooksBuildSender);
      }

      const totalTime = Date.now() - startTime;
      if (this.nodeEnv !== 'production') {
        console.log(`[BATCH-${tasks.length}] Processed in ${totalTime}ms`);
      }

      return {
        queueResultsSuccess,
        queueResultsFailed,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(
        `[BATCH-${tasks.length}] Error processing after ${totalTime}ms:`,
        error,
      );
      throw error;
    }
  }

  async processAnticipation(tasks: QueueTasksAnticipationsProcessor[]) {
    const startTime = Date.now();
    const now = new Date();

    if (this.nodeEnv !== 'production') {
      console.log({
        'type - system': 'ANTICIPATION',
        mode: 'BATCH',
        count: tasks.length,
        'data - system': format(now, 'dd-MM-yyyy HH:mm:ss'),
      });
    }

    const anticipationsIds = tasks.map((d) => d.anticipationId);
    const anticipations = await this.prisma.anticipation.findMany({
      where: {
        id: { in: anticipationsIds },
        status: 'PENDING',
      },
    });

    const anticipationsMap = new Map(anticipations.map((a) => [a.id, a]));

    const queueResultsFailed: QueueResultTaskFailed[] = [];
    const queueResultsSuccess: string[] = [];
    const transactionsToCreate: CreateTransactionData[] = [];

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const anticipationsUpdates: AnticipationsUpdates[] = [];

          for (const task of tasks) {
            const anticipation = anticipationsMap.get(task.anticipationId);
            if (!anticipation) {
              queueResultsFailed.push({
                error: 'Anticipation not found',
                taskId: task.queueTaskId,
              });
              continue;
            }

            const paymentReleaseScheduledAggregate =
              await tx.payment_release_schedule.aggregate({
                where: {
                  company_id: anticipation.company_id,
                  type: anticipation.type,
                  status: 'SCHEDULED',
                  currency: anticipation.currency,
                },
                _sum: {
                  amount_net: true,
                },
              });

            const amountPendingToAnticipate =
              paymentReleaseScheduledAggregate._sum.amount_net || 0;

            if (amountPendingToAnticipate < anticipation.amount_net) {
              queueResultsFailed.push({
                error:
                  'Insufficient amount pending to anticipate for the requested amount',
                taskId: task.queueTaskId,
              });
              continue;
            }

            anticipationsUpdates.push({
              anticipationId: anticipation.id,
              updateData: {
                status: 'PROCESSING',
                processed_at: now,
              },
            });

            await this.prisma.payment_release_schedule.updateMany({
              where: {
                payment_id: {
                  in: anticipation.payments_ids,
                },
                type: anticipation.type,
              },
              data: {
                processed_at: now,
                status: 'COMPLETED',
                anticipated_at: now,
              },
            });

            if (anticipation.type === 'INSTALLMENT') {
              transactionsToCreate.push(
                {
                  amount: MoneyUtil.negate(anticipation.total_amount),
                  amountFee: 0,
                  amountNet: MoneyUtil.negate(anticipation.total_amount),
                  accountType: 'BALANCE_PENDING',
                  companyId: anticipation.company_id,
                  currency: anticipation.currency,
                  description: `Antecipação: Pending > Available: ${anticipation.id}`,
                  method: 'CREDIT_CARD',
                  movementType: 'DEBIT',
                  operationType: 'SYSTEM',
                  sourceId: anticipation.id,
                  webhookStatus: 'APPROVED',
                },
                {
                  amount: anticipation.total_amount,
                  amountFee: anticipation.amount_fee,
                  amountNet: anticipation.amount_net,
                  accountType: 'BALANCE_AVAILABLE',
                  companyId: anticipation.company_id,
                  currency: anticipation.currency,
                  description: `Antecipação: Pending > Available: ${anticipation.id}`,
                  method: 'CREDIT_CARD',
                  movementType: 'CREDIT',
                  operationType: 'SYSTEM',
                  sourceId: anticipation.id,
                  webhookStatus: 'APPROVED',
                },
              );
            }

            queueResultsSuccess.push(task.queueTaskId);
          }

          if (anticipationsUpdates.length > 0) {
            await this.handleAnticipationsUpdates(anticipationsUpdates, tx);
          }

          if (transactionsToCreate.length > 0) {
            await this.createTransactionWallet({
              tx,
              sourceId: `batch-anticipation-${Date.now()}`,
              transactions: transactionsToCreate,
            });
          }
        },
        {
          maxWait: 20000,
          timeout: 60000,
        },
      );

      const totalTime = Date.now() - startTime;
      if (this.nodeEnv !== 'production') {
        console.log(`[BATCH-${tasks.length}] Processed in ${totalTime}ms`);
      }

      return {
        queueResultsSuccess,
        queueResultsFailed,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(
        `[BATCH-${tasks.length}] Error processing after ${totalTime}ms:`,
        error,
      );
      throw error;
    }
  }

  async processPaymentReleaseSchedule(
    tasks: QueueTasksPaymentReleaseSchedulesProcessor[],
  ) {
    const startTime = Date.now();
    const now = new Date();

    if (this.nodeEnv !== 'production') {
      console.log({
        'type - job': 'SCHEDULED',
        mode: 'BATCH',
        count: tasks.length,
        'data - job': format(new Date(), 'dd-MM-yyyy HH:mm:ss'),
      });
    }

    const schedulesIds = tasks.map((d) => d.paymentReleaseScheduleId);

    const schedules = await this.prisma.payment_release_schedule.findMany({
      where: {
        id: { in: schedulesIds },
        status: 'SCHEDULED',
      },
    });

    const schedulesMap = new Map(schedules.map((s) => [s.id, s]));

    const queueResultsFailed: QueueResultTaskFailed[] = [];
    const queueResultsSuccess: string[] = [];

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const paymentsUpdates: PaymentsUpdates[] = [];
          const schedulesUpdates: PaymentReleaseSchedulesUpdates[] = [];
          const transactionsSchedulesToCreate: CreateTransactionPaymentSchedulesData[] =
            [];

          for (const task of tasks) {
            const schedule = schedulesMap.get(task.paymentReleaseScheduleId);
            if (!schedule) {
              queueResultsFailed.push({
                error: 'Payment release schedule not found',
                taskId: task.queueTaskId,
              });
              continue;
            }

            const fromAccount =
              this.paymentReleaseScheduleService.getSourceAccount(
                schedule.type,
              );

            transactionsSchedulesToCreate.push({
              sourceId: schedule.payment_id,
              amount: MoneyUtil.negate(schedule.amount_net),
              amountFee: 0,
              amountNet: MoneyUtil.negate(schedule.amount_net),
              accountType: fromAccount,
              movementType: 'DEBIT',
              operationType: 'SYSTEM',
              companyId: schedule.company_id,
              currency: schedule.currency,
              method: schedule.method,
              webhookStatus: 'APPROVED',
              description:
                this.paymentReleaseScheduleService.getDescription(schedule),
              installments: schedule.installment_number,
            });

            transactionsSchedulesToCreate.push({
              sourceId: schedule.payment_id,
              amount: schedule.amount_net,
              amountFee: 0,
              amountNet: schedule.amount_net,
              accountType: 'BALANCE_AVAILABLE',
              movementType: 'CREDIT',
              operationType: 'SYSTEM',
              companyId: schedule.company_id,
              currency: schedule.currency,
              method: schedule.method,
              webhookStatus: 'APPROVED',
              description:
                this.paymentReleaseScheduleService.getDescription(schedule),
              installments: schedule.installment_number,
            });

            schedulesUpdates.push({
              paymentReleaseScheduleId: schedule.id,
              updateData: {
                processed_at: now,
                status: 'COMPLETED',
              },
            });

            if (
              schedule.type === 'INSTALLMENT' &&
              schedule.installment_number &&
              schedule.total_installments &&
              schedule.installment_number === schedule.total_installments
            ) {
              paymentsUpdates.push({
                paymentId: schedule.payment_id,
                updateData: {
                  installments_amount_pending: 0,
                  installments_amount_received: schedule.amount_gross,
                  installments_qty_received: schedule.total_installments,
                  available_status: 'COMPLETED',
                },
              });
            }

            if (
              schedule.type === 'INSTALLMENT' &&
              schedule.installment_number &&
              schedule.total_installments &&
              schedule.installment_number < schedule.total_installments
            ) {
              paymentsUpdates.push({
                paymentId: schedule.payment_id,
                updateData: {
                  installments_amount_pending: 0,
                  installments_amount_received:
                    schedule.installment_number * schedule.amount_net,
                  installments_qty_received: schedule.installment_number,
                },
              });
            }

            if (schedule.type === 'PENDING_TO_AVAILABLE') {
              paymentsUpdates.push({
                paymentId: schedule.payment_id,
                updateData: {
                  available_status: 'COMPLETED',
                },
              });
            }

            if (schedule.type === 'RESERVE_RELEASE') {
              paymentsUpdates.push({
                paymentId: schedule.payment_id,
                updateData: {
                  available_reserve_status: 'COMPLETED',
                },
              });
            }

            queueResultsSuccess.push(task.queueTaskId);
          }

          if (schedulesUpdates.length > 0) {
            await this.handlePaymentReleaseSchedulesUpdates(
              schedulesUpdates,
              tx,
            );
          }

          if (transactionsSchedulesToCreate.length > 0) {
            await this.transactionService.createManyPaymentSchedules({
              tx,
              transactions: transactionsSchedulesToCreate,
              sourceId: `batch-infraction-${Date.now()}`,
            });
          }

          if (paymentsUpdates.length > 0) {
            await this.handlePaymentsUpdates(paymentsUpdates, tx);
          }
        },
        {
          maxWait: 20000,
          timeout: 60000,
        },
      );

      return {
        queueResultsSuccess,
        queueResultsFailed,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(
        `[BATCH-${tasks.length}] Error processing after ${totalTime}ms:`,
        error,
      );
      throw error;
    }
  }
}
