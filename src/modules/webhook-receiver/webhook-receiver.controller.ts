import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiExcludeController, ApiExcludeEndpoint } from '@nestjs/swagger';
import { provider_name } from '@prisma/client';
import { RequestMetadata } from 'src/common/decorators/request-metadata.decorator';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { providers } from 'src/infrastructure/gateways';
import {
  InfractionWebhookData,
  PaymentWebhookData,
  WithdrawalWebhookData,
} from 'src/infrastructure/gateways/base-payment.provider';
import { QueueTasksInfractionsProcessor } from 'src/infrastructure/queue/interfaces/queue.interfaces';

@ApiExcludeController()
@Controller('/api/webservice/callbacks/')
export class WebhookReceiverController {
  constructor(private readonly prisma: PrismaService) {}

  private webhookReceivedSuccess() {
    return {
      status: 'ok',
      message: 'Webhook received',
    };
  }

  private async handleInfractionWebhook(
    payloadTask: InfractionWebhookData,
    providerName: provider_name,
    ip: string,
    startTime: Date,
  ) {
    if (!payloadTask.providerPaymentId) {
      throw new Error('Invalid payload payment id');
    }

    const [payment, infraction] = await Promise.all([
      this.prisma.payment.findUnique({
        where: {
          payment_provider_payment_id_provider_name_unique: {
            provider_name: providerName.toUpperCase() as provider_name,
            provider_payment_id: payloadTask.providerPaymentId,
          },
        },
      }),
      this.prisma.infraction.findUnique({
        where: {
          provider_infraction_id: payloadTask.providerInfractionId,
        },
      }),
    ]);

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'REFUNDED' || payment.status === 'CHARGEDBACK') {
      return this.webhookReceivedSuccess();
    }

    if (infraction && ['CLOSED', 'CANCELLED'].includes(infraction.status)) {
      return this.webhookReceivedSuccess();
    }

    if (infraction && infraction.status === payloadTask.infractionStatus) {
      return this.webhookReceivedSuccess();
    }

    const payloadTaskFormatted: QueueTasksInfractionsProcessor = {
      analysisResult: payloadTask.infractionAnalysisResult || undefined,
      analysisReason: payloadTask.analysisReason,
      providerInfractionId: payloadTask.providerInfractionId,
      providerName: providerName.toUpperCase() as provider_name,
      providerPaymentId: payloadTask.providerPaymentId,
      providerResponse: payloadTask.providerResponse,
      queueTaskId: UniqueIDGenerator.generate(),
      reason: payloadTask.infractionReason,
      statusInfraction: payloadTask.infractionStatus,
      endToEndId: undefined,
    };

    const id = UniqueIDGenerator.generate();
    await this.prisma.queue.create({
      data: {
        id,
        ip,
        description: providerName.toUpperCase(),
        time: new Date().getTime() - startTime.getTime(),
        payload: payloadTaskFormatted as any,
        company_id: payment.company_id,
        payment_id: payment.id,
        type: 'INFRACTION',
      },
    });

    return this.webhookReceivedSuccess();
  }

  private async handlePaymentWebhook(
    payloadTask: PaymentWebhookData,
    provider: string,
    ip: string,
    startTime: Date,
  ) {
    if (
      payloadTask.webhookStatus === 'PENDING' ||
      payloadTask.webhookStatus === 'FAILED' ||
      payloadTask.webhookStatus === 'EXPIRED'
    ) {
      return this.webhookReceivedSuccess();
    }

    const payment = await this.prisma.payment.findUnique({
      where: {
        payment_provider_payment_id_provider_name_unique: {
          provider_name: provider.toUpperCase() as provider_name,
          provider_payment_id: payloadTask.providerPaymentId,
        },
      },
      select: { id: true, status: true, company_id: true },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment && payment.status === payloadTask.webhookStatus) {
      return this.webhookReceivedSuccess();
    }

    if (
      payment.status === 'ERROR_SYSTEM' ||
      payment.status === 'FAILED' ||
      payment.status === 'EXPIRED' ||
      payment.status === 'REFUSED'
    ) {
      return this.webhookReceivedSuccess();
    }

    if (
      payment &&
      payment.status === 'REFUNDED' &&
      payloadTask.webhookStatus !== 'REFUNDED'
    ) {
      return this.webhookReceivedSuccess();
    }

    if (
      payment &&
      payment.status === 'CHARGEDBACK' &&
      payloadTask.webhookStatus !== 'CHARGEDBACK'
    ) {
      return this.webhookReceivedSuccess();
    }

    const id = UniqueIDGenerator.generate();
    await this.prisma.queue.create({
      data: {
        id,
        ip,
        description: provider.toUpperCase(),
        time: new Date().getTime() - startTime.getTime(),
        payload: payloadTask as any,
        company_id: payment.company_id,
        payment_id: payment.id,
        type: 'PAYMENT',
      },
    });

    return this.webhookReceivedSuccess();
  }

  private async handleWithdrawalWebhook(
    payloadTask: WithdrawalWebhookData,
    provider: string,
    ip: string,
    startTime: Date,
  ) {
    if (
      payloadTask.webhookStatus === 'PENDING' ||
      payloadTask.webhookStatus === 'PROCESSING'
    ) {
      return this.webhookReceivedSuccess();
    }

    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: {
        provider_withdrawal_id_provider_name: {
          provider_name: provider.toUpperCase() as provider_name,
          provider_withdrawal_id: String(payloadTask.providerWithdrawalId),
        },
      },
      select: { id: true, status: true, company_id: true, amount: true },
    });

    if (withdrawal && withdrawal.status === payloadTask.webhookStatus) {
      return this.webhookReceivedSuccess();
    }

    if (
      withdrawal &&
      withdrawal.status === 'REFUNDED' &&
      withdrawal.amount !== payloadTask.amount
    ) {
      throw new Error('Invalid amount for refunded withdrawal');
    }

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }
    const id = UniqueIDGenerator.generate();

    await this.prisma.queue.create({
      data: {
        id,
        ip,
        description: provider.toUpperCase(),
        time: new Date().getTime() - startTime.getTime(),
        payload: payloadTask as any,
        company_id: withdrawal.company_id,
        withdrawal_id: withdrawal.id,
        type: 'WITHDRAWAL',
      },
    });

    return this.webhookReceivedSuccess();
  }

  @ApiExcludeEndpoint()
  @Post(':provider/:secret')
  @HttpCode(HttpStatus.OK)
  async processWebhookProvider(
    @Headers('x-healthcheck') healthcheck: string,
    @Headers('content-type') contentType: string,
    @Param('provider') provider: string,
    @Param('secret') secret: string,
    @RequestMetadata() { ipAddress }: RequestMetadata,
    @Body() payload: any,
  ) {
    const startTime = new Date();

    if (healthcheck === 'true') {
      return { status: 'ok', message: 'Webhook is active' };
    }

    if (!contentType.includes('application/json')) {
      throw new Error('Invalid content type');
    }

    const ProvidersGateways = providers.find(
      (p) =>
        p.providerName.toLocaleLowerCase() === provider.toLocaleLowerCase(),
    );

    if (!ProvidersGateways) {
      throw new Error('IP Unauthorized');
    }

    const webhookSecretIsValid = ProvidersGateways.verifyWebhookSecret(secret);

    if (!webhookSecretIsValid) {
      throw new Error('Invalid secret');
    }

    const payloadTask = ProvidersGateways.processWebhook(payload);

    if (!payloadTask) {
      throw new Error('Invalid payload');
    }

    if (payloadTask.type === 'INFRACTION') {
      return await this.handleInfractionWebhook(
        payloadTask,
        provider as provider_name,
        ipAddress,
        startTime,
      );
    }

    if (!payloadTask.webhookStatus) {
      throw new Error('Invalid payload status');
    }

    switch (payloadTask.type) {
      case 'PAYMENT':
        return await this.handlePaymentWebhook(
          payloadTask,
          provider,
          ipAddress,
          startTime,
        );

      case 'WITHDRAWAL':
        return await this.handleWithdrawalWebhook(
          payloadTask,
          provider,
          ipAddress,
          startTime,
        );

      default:
        throw new Error('Invalid payload type');
    }
  }
}
