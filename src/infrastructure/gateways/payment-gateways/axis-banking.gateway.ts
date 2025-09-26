import {
  infraction_analysis_result,
  infraction_status,
  payment_status,
  provider_environment,
  provider_name,
  withdrawal_status,
} from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import {
  BalanceResponse,
  BasePaymentProvider,
  CreatePaymentInput,
  PaymentResponse,
  RefundPaymentInput,
  WebhookData,
  WithdrawalData,
  WithdrawalResponse,
} from '../base-payment.provider';

export class AxisBankingGatewayProvider extends BasePaymentProvider {
  static providerName: provider_name = 'AXIS_BANKING';
  private api: AxiosInstance;

  constructor(
    protected publicKeyCashin: string | null,
    protected secretKeyCashin: string,
    protected publicKeyCashout: string | null,
    protected secretKeyCashout: string | null,
    protected certCrtCashin: string | null,
    protected certKeyCashin: string | null,
    protected certCrtCashOut: string | null,
    protected certKeyCashOut: string | null,
    protected receiverId: string | null,
    protected environment: provider_environment | null,
    public baseUrl: string | null,
    private cacheService: CacheService | null,
    private providerId: string | null,
  ) {
    super(
      publicKeyCashin,
      secretKeyCashin,
      publicKeyCashout,
      secretKeyCashout,
      certCrtCashin,
      certKeyCashin,
      certCrtCashOut,
      certKeyCashOut,
      receiverId,
      environment,
      baseUrl,
    );

    this.api = axios.create({
      baseURL: 'https://api.axisbanking.com.br',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          'Basic ' +
          Buffer.from('secret:' + this.secretKeyCashin).toString('base64'),
      },
    });
  }

  // Método auxiliar para gerar dados dummy
  private generateDummyData(paymentMethod: string) {
    const now = new Date();
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hora

    switch (paymentMethod) {
      case 'PIX':
        return {
          pixCode:
            '00020126360014BR.GOV.BCB.PIX0114+5511999887766520400005303986540510.005802BR5925AXIS BANKING GATEWAY TEST6009SAO PAULO62070503***630463E8',
          qrCodeUrl:
            'https://sandbox.axisbanking.com.br/qrcode/dummy-qr-code.png',
          expiresAt,
        };

      case 'CREDIT_CARD':
        return {
          authCodeCreditCard:
            'AUTH' + Math.random().toString(36).substring(2, 10).toUpperCase(),
          binCreditCard: '543210',
          last4CreditCard: '4321',
          installmentAmount: 0,
          totalAmount: 0,
          nsu: 'NSU' + Date.now().toString().slice(-8),
          tid: 'TID' + Date.now().toString(),
          acquirerName: 'AXIS_ACQUIRING',
          acquirerReturnCode: '00',
          acquirerReturnMessage: 'Transaction approved successfully',
        };

      case 'BILLET':
        const billetNumber =
          Date.now().toString() + Math.random().toString().slice(2, 6);
        return {
          billetUrl: `https://sandbox.axisbanking.com.br/boletos/${billetNumber}.pdf`,
          billetBarcode:
            '34191.79001 01043.510047 91020.150008 1 ' +
            Math.floor(Math.random() * 90000000000 + 10000000000),
          billetNumber,
          billetDigitableLine:
            '34191790010104351004791020150008100000000' +
            Math.random().toString().slice(2, 6),
          dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000), // 3 dias
          expiresAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
          documentNumber: 'DOC' + Date.now().toString().slice(-10),
        };

      default:
        return {};
    }
  }

  static verifyWebhookSecret(secret: string): boolean {
    return secret === '123';
  }

  static parseStatus(status: string): payment_status {
    switch (status) {
      case 'PENDING':
        return 'PENDING';
      case 'APPROVED':
        return 'APPROVED';
      case 'BLOCKED':
        return 'IN_DISPUTE';
      case 'REFUNDED':
      case 'REFUND':
        return 'REFUNDED';
      case 'REJECTED':
        return 'REFUSED';
      default:
        return 'ERROR_SYSTEM';
    }
  }

  static parseWithdrawalStatus(status: string): withdrawal_status {
    switch (status) {
      case 'WITHDRAW_REQUEST':
      case 'WITHDRAW_PROCESSING':
        return 'PENDING';
      case 'WITHDRAW_APPROVED':
        return 'APPROVED';
      case 'WITHDRAW_RETURNED':
        return 'REFUNDED';
      case 'WITHDRAW_ERROR':
        return 'FAILED';
      default:
        return 'ERROR_SYSTEM';
    }
  }

  static parseInfractionStatus(status: string): infraction_status {
    switch (status) {
      case 'AWAITING_CUSTOMER_RESPONSE':
      case 'AWAITING_ADDITIONAL_INFO':
        return 'AWAITING_COMPANY_RESPONSE';
      case 'UNDER_REVIEW':
        return 'UNDER_REVIEW';
      case 'CANCELLED':
        return 'CANCELLED';
      case 'CLOSED':
        return 'CLOSED';
      default:
        return 'ERROR_SYSTEM';
    }
  }

  static parseInfractionAnalysisResultStatus(
    status: string,
  ): infraction_analysis_result | undefined {
    switch (status) {
      case 'AGREED':
        return 'AGREED';
      case 'DISAGREED':
        return 'DISAGREED';
    }
  }

  static processWebhook(data: any): WebhookData | undefined {
    if (data.type === 'TRANSACTION') {
      const status = AxisBankingGatewayProvider.parseStatus(data.status);

      if (status === 'IN_DISPUTE') {
        return {
          type: 'INFRACTION',
          infractionType: 'MED',
          infractionAnalysisResult:
            AxisBankingGatewayProvider.parseInfractionAnalysisResultStatus(
              data.infraction.analysisResult,
            ),
          infractionReason: data.infraction.reasonDetails,
          infractionStatus: AxisBankingGatewayProvider.parseInfractionStatus(
            data.infraction.status,
          ),
          providerInfractionId: data.infraction.id,
          analysisReason: data.infraction.analysisDetails || null,
          providerPaymentId: data.transactionId,
          providerResponse: data,
        };
      }

      return {
        type: 'PAYMENT',
        providerPaymentId: data.transactionId,
        webhookStatus: status,
        amount: data.amount,
        endToEndId: data.endToEnd || null,
        providerResponse: data,
      };
    }

    if (data.type === 'WITHDRAW') {
      return {
        type: 'WITHDRAWAL',
        providerWithdrawalId: data.withdrawId,
        webhookStatus: AxisBankingGatewayProvider.parseWithdrawalStatus(
          data.status,
        ),
        amount: data.amount,
        endToEndId: data.endToEnd || null,
        errorMessage: data.errorMessage || null,
        providerResponse: data,
      };
    }

    return undefined;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResponse> {
    if (this.environment === 'SANDBOX') {
      // Gera ID único para sandbox
      const sandboxId =
        'SANDBOX_' +
        Date.now() +
        '_' +
        Math.random().toString(36).substring(2, 9);

      // Dados base comuns a todos os métodos
      const baseResponse: PaymentResponse = {
        providerPaymentId: sandboxId,
        status: 'PENDING',
        amount: input.amount,
        paymentMethod: input.paymentMethod,
      };

      // Adiciona dados específicos por método de pagamento
      if (input.paymentMethod === 'PIX') {
        const pixData = this.generateDummyData('PIX');
        return {
          ...baseResponse,
          pixCode: pixData.pixCode,
          expiresAt: pixData.expiresAt,
          providerResponse: {
            id: sandboxId,
            status: 'PENDING',
            amount: input.amount,
            method: 'PIX',
            qrCodeUrl: pixData.qrCodeUrl,
            createdAt: new Date().toISOString(),
            ...pixData,
          },
        };
      }

      if (input.paymentMethod === 'CREDIT_CARD') {
        const cardData = this.generateDummyData('CREDIT_CARD');
        // Simula aprovação imediata para cartão de crédito
        return {
          ...baseResponse,
          status: 'APPROVED',
          authCodeCreditCard: cardData.authCodeCreditCard,
          providerResponse: {
            id: sandboxId,
            status: 'APPROVED',
            amount: input.amount,
            method: 'CREDIT_CARD',
            installments: input.creditCard?.installments || 1,
            installmentAmount:
              input.amount / (input.creditCard?.installments || 1),
            totalAmount: input.amount,
            cardHolder: input.creditCard?.holder,
            cardBin: cardData.binCreditCard,
            cardLast4: cardData.last4CreditCard,
            createdAt: new Date().toISOString(),
            approvedAt: new Date().toISOString(),
            ...cardData,
          },
        };
      }

      if (input.paymentMethod === 'BILLET') {
        const billetData = this.generateDummyData('BILLET');
        return {
          ...baseResponse,
          billetUrl: billetData.billetUrl,
          billetBarcode: billetData.billetBarcode,
          expiresAt: billetData.expiresAt,
          providerResponse: {
            id: sandboxId,
            status: 'PENDING',
            amount: input.amount,
            method: 'BILLET',
            createdAt: new Date().toISOString(),
            ...billetData,
          },
        };
      }

      // Fallback para métodos não suportados
      throw new Error(`Unsupported payment method: ${input.paymentMethod}`);
    }

    // Código de produção (API real)
    try {
      if (input.paymentMethod === 'PIX') {
        const { data } = await this.api.post('/transactions/purchase', {
          name: input.customer.name,
          phone: input.customer.phone,
          email: input.customer.email,
          cpf: input.customer.document,
          description: input.description,
          amount: input.amount,
          postbackUrl: `${input.webhookUrl}/123`,
          responsibleDocument: input.company.document,
          responsibleExternalId: input.company.id,
        });

        return {
          providerPaymentId: data.id,
          status: AxisBankingGatewayProvider.parseStatus(data.status),
          amount: input.amount,
          paymentMethod: 'PIX',
          pixCode: data.pixCode,
          expiresAt: data.expiresAt,
          providerResponse: data,
        };
      }

      if (input.paymentMethod === 'CREDIT_CARD') {
        const { data } = await this.api.post('/transactions/credit-card', {
          name: input.customer.name,
          phone: input.customer.phone,
          email: input.customer.email,
          cpf: input.customer.document,
          description: input.description,
          amount: input.amount,
          postbackUrl: `${input.webhookUrl}/123`,
          responsibleDocument: input.company.document,
          responsibleExternalId: input.company.id,
          cardNumber: input.creditCard?.number,
          cardHolder: input.creditCard?.holder,
          cardExpMonth: input.creditCard?.expMonth,
          cardExpYear: input.creditCard?.expYear,
          cardCvv: input.creditCard?.cvv,
          installments: input.creditCard?.installments || 1,
        });

        return {
          providerPaymentId: data.id,
          status: AxisBankingGatewayProvider.parseStatus(data.status),
          amount: input.amount,
          paymentMethod: 'CREDIT_CARD',
          authCodeCreditCard: data.authCode,
          providerResponse: data,
        };
      }

      if (input.paymentMethod === 'BILLET') {
        const { data } = await this.api.post('/transactions/billet', {
          name: input.customer.name,
          phone: input.customer.phone,
          email: input.customer.email,
          cpf: input.customer.document,
          description: input.description,
          amount: input.amount,
          postbackUrl: `${input.webhookUrl}/123`,
          responsibleDocument: input.company.document,
          responsibleExternalId: input.company.id,
          dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(), // 3 dias
        });

        return {
          providerPaymentId: data.id,
          status: AxisBankingGatewayProvider.parseStatus(data.status),
          amount: input.amount,
          paymentMethod: 'BILLET',
          billetUrl: data.billetUrl,
          billetBarcode: data.billetBarcode,
          expiresAt: data.dueDate,
          providerResponse: data,
        };
      }

      throw new Error(`Unsupported payment method: ${input.paymentMethod}`);
    } catch (error: any) {
      throw {
        statusText: error?.response?.statusText,
        statusCode: error?.response?.status,
        message: error.message,
        responseData: error?.response?.data,
      };
    }
  }

  async getPayment(paymentId: string): Promise<PaymentResponse> {
    // Sandbox mode
    if (this.environment === 'SANDBOX') {
      // Simula diferentes estados baseados no ID
      const isCreditCard = paymentId.includes('CARD');
      const isBillet = paymentId.includes('BILLET');

      if (isCreditCard) {
        const cardData = this.generateDummyData('CREDIT_CARD');
        return {
          providerPaymentId: paymentId,
          status: 'APPROVED',
          amount: 100.0,
          paymentMethod: 'CREDIT_CARD',
          authCodeCreditCard: cardData.authCodeCreditCard,
          providerResponse: {
            id: paymentId,
            status: 'APPROVED',
            amount: 100.0,
            method: 'CREDIT_CARD',
            ...cardData,
          },
        };
      }

      if (isBillet) {
        const billetData = this.generateDummyData('BILLET');
        return {
          providerPaymentId: paymentId,
          status: 'PENDING',
          amount: 150.0,
          paymentMethod: 'BILLET',
          billetUrl: billetData.billetUrl,
          billetBarcode: billetData.billetBarcode,
          expiresAt: billetData.expiresAt,
          providerResponse: {
            id: paymentId,
            status: 'PENDING',
            amount: 150.0,
            method: 'BILLET',
            ...billetData,
          },
        };
      }

      // Default PIX
      const pixData = this.generateDummyData('PIX');
      return {
        providerPaymentId: paymentId,
        status: 'PENDING',
        amount: 200.0,
        paymentMethod: 'PIX',
        pixCode: pixData.pixCode,
        endToEndId: 'E18236120202312181234567890123456',
        providerResponse: {
          id: paymentId,
          status: 'PENDING',
          amount: 200.0,
          method: 'PIX',
          ...pixData,
        },
      };
    }

    // Produção
    try {
      const { data } = await this.api.get(`/transactions/${paymentId}`);

      return {
        providerPaymentId: data.id,
        status: AxisBankingGatewayProvider.parseStatus(data.status),
        amount: data.amount,
        paymentMethod: 'PIX',
        pixCode: data.pixCode,
        endToEndId: data.end2End,
        providerResponse: data,
      };
    } catch (error: any) {
      throw {
        statusText: error?.response?.statusText,
        statusCode: error?.response?.status,
        message: error.message,
        responseData: error?.response?.data,
      };
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<PaymentResponse> {
    // Sandbox mode
    if (this.environment === 'SANDBOX') {
      return {
        providerPaymentId: input.providerPaymentId,
        status: 'REFUNDED_PROCESSING',
        amount: input.amount,
        paymentMethod: 'PIX',
        providerResponse: {
          id: input.providerPaymentId,
          refundId: 'REFUND_' + Date.now(),
          status: 'REFUNDED_PROCESSING',
          amount: input.amount,
          originalTransactionId: input.providerPaymentId,
          refundRequestedAt: new Date().toISOString(),
          estimatedRefundDate: new Date(
            Date.now() + 24 * 3600 * 1000,
          ).toISOString(),
        },
      };
    }

    // Produção
    try {
      const { data } = await this.api.post(
        `/transactions/refund/${input.providerPaymentId}`,
        { amount: input.amount },
      );

      return {
        providerPaymentId: data.id,
        status: 'REFUNDED_PROCESSING',
        amount: input.amount,
        paymentMethod: 'PIX',
        providerResponse: data,
      };
    } catch (error: any) {
      throw {
        statusText: error?.response?.statusText,
        statusCode: error?.response?.status,
        message: error.message,
        responseData: error?.response?.data,
      };
    }
  }

  async getBalance(): Promise<BalanceResponse> {
    // Sandbox mode
    if (this.environment === 'SANDBOX') {
      return {
        available: 15000.0,
        blocked: 500.0,
        pending: 2500.0,
        reserved: 1000.0,
        total: 19000.0,
      };
    }

    // Produção
    try {
      const { data } = await this.api.get('/users/balance');

      return {
        available: data.balance,
        blocked: data.precautionaryBlock,
        pending: data.pendingBalance,
        reserved: data.garanteeBalance,
        total: data.balance + data.pendingBalance + data.garanteeBalance,
      };
    } catch (error: any) {
      throw {
        statusText: error?.response?.statusText,
        statusCode: error?.response?.status,
        message: error.message,
        responseData: error?.response?.data,
      };
    }
  }

  async getBalanceBlocked(): Promise<{ blocked: number }> {
    // Sandbox mode
    if (this.environment === 'SANDBOX') {
      return { blocked: 500.0 };
    }

    // Produção
    try {
      const { data } = await this.api.get('/users/balance');
      return { blocked: data.blocked };
    } catch (error: any) {
      throw {
        statusText: error?.response?.statusText,
        statusCode: error?.response?.status,
        message: error.message,
        responseData: error?.response?.data,
      };
    }
  }

  async getWithdrawal(
    withdrawalId: string,
    endToEndId?: string,
  ): Promise<WithdrawalResponse> {
    // Sandbox mode
    if (this.environment === 'SANDBOX') {
      return {
        providerWithdrawalId: withdrawalId,
        status: 'APPROVED',
        amount: 1000.0,
        approvedAt: new Date(),
        endToEndId: endToEndId || 'E18236120202312191234567890123456',
        providerResponse: {
          id: withdrawalId,
          status: 'WITHDRAW_APPROVED',
          amount: 1000.0,
          end2End: endToEndId || 'E18236120202312191234567890123456',
          approvedAt: new Date().toISOString(),
        },
      };
    }

    // Produção - não implementado ainda
    throw new Error('Method not implemented for production environment.');
  }

  async createWithdrawal(input: WithdrawalData): Promise<WithdrawalResponse> {
    if (this.environment === 'SANDBOX') {
      const sandboxWithdrawalId =
        'WD_SANDBOX_' +
        Date.now() +
        '_' +
        Math.random().toString(36).substring(2, 9);

      return {
        amount: input.amount,
        providerWithdrawalId: sandboxWithdrawalId,
        status: 'PENDING',
        providerResponse: {
          id: sandboxWithdrawalId,
          status: 'WITHDRAW_REQUEST',
          amount: input.amount,
          pixType: input.pixType,
          pixKey: input.pixKey,
          receiverDocument: input.receiverDocument,
          createdAt: new Date().toISOString(),
          estimatedCompletionDate: new Date(
            Date.now() + 30 * 60 * 1000,
          ).toISOString(), // 30 minutos
        },
      };
    }

    // Produção
    try {
      let pixKey = input.pixKey;
      const pixType = input.pixType;

      if (['CPF', 'CNPJ', 'PHONE'].includes(pixType)) {
        pixKey = pixKey.replace(/[^\d]/g, '');
      }

      const payload = {
        pixType: pixType,
        pixKey,
        amount: input.amount,
        externalId: input.myWithdrawalId,
        document: input.receiverDocument,
        postbackUrl: `${input.webhookUrl}/123`,
      };

      const response = await this.api.post('/withdraws/cash-out', payload);

      const status = AxisBankingGatewayProvider.parseWithdrawalStatus(
        response.data.status,
      );

      return {
        providerWithdrawalId: response.data.id,
        status,
        amount: input.amount,
        providerResponse: response.data,

        ...(status === 'APPROVED' && { approvedAt: new Date() }),
        ...(response.data.end2End && {
          endToEndId: response.data.end2End,
        }),
        ...(response.data.errorMessage && {
          errorMessage: response.data.errorMessage,
        }),
        ...(status === 'FAILED' && { failedAt: new Date() }),
      };
    } catch (err) {
      throw {
        statusText: err?.response?.statusText,
        statusCode: err?.response?.status,
        message: err.message,
        responseData: err?.response?.data,
      };
    }
  }
}
