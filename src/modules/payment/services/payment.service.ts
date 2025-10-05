import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { WebhookConstants } from 'src/common/constants/webhook.constants';
import { CreditCardUtils } from 'src/common/utils/credit-card.util';
import { UniqueIDGenerator } from 'src/common/utils/unique-id-generator';
import { GatewayProviderFactoryService } from 'src/infrastructure/gateways/gateway-provider-factory.service';
import { Company } from 'src/modules/company/entities/company.entity';
import { CustomerService } from 'src/modules/customer/services/customer.service';
import { ERROR_MESSAGES } from '../constants/payment.constants';
import { CreatePaymentRequestDto } from '../dto/payment.dto';
import { Currency } from '../entities/currency.entity';
import { Payment } from '../entities/payment.entity';
import {
  CompanyApiKey,
  IPaymentResponse,
} from '../interfaces/transaction.interfaces';
import { PaymentRepository } from '../repositories/payment.repository';
import { PaymentFeeCalculatorService } from './payment-fee-calculator.service';
import { PaymentProcessorService } from './payment-processor.service';
import { PaymentValidatorService } from './payment-validator.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly repository: PaymentRepository,
    private readonly validator: PaymentValidatorService,
    private readonly feeCalculator: PaymentFeeCalculatorService,
    private readonly processor: PaymentProcessorService,
    private readonly providerFactory: GatewayProviderFactoryService,
    private readonly customerService: CustomerService,
  ) {}

  // private async validateCreateSystemStatus() {
  //   const cached: any = await this.cacheManager.get(
  //     PAYMENT_CONSTANTS.SYSTEM_CACHE_KEY,
  //   );

  //   if (cached.all_cashins_active === false) {
  //     throw new HttpException(
  //       {
  //         status: HttpStatus.BAD_REQUEST,
  //         message: ERROR_MESSAGES.SYSTEM_DISABLED,
  //       },
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }

  //   if (!cached) {
  //     await this.cacheManager.set(
  //       PAYMENT_CONSTANTS.SYSTEM_CACHE_KEY,
  //       { allCashinsActive: true },
  //       PAYMENT_CONSTANTS.CACHE_TTL,
  //     );
  //   }
  // }

  // private async validateRefundSystemStatus() {
  //   const cached: any = await this.cacheManager.get(
  //     PAYMENT_CONSTANTS.SYSTEM_CACHE_KEY,
  //   );

  //   if (cached.all_refunds_active === false) {
  //     throw new HttpException(
  //       {
  //         status: HttpStatus.BAD_REQUEST,
  //         message: ERROR_MESSAGES.SYSTEM_DISABLED,
  //       },
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }

  //   if (!cached) {
  //     await this.cacheManager.set(
  //       PAYMENT_CONSTANTS.SYSTEM_CACHE_KEY,
  //       { allRefundsActive: true },
  //       PAYMENT_CONSTANTS.CACHE_TTL,
  //     );
  //   }
  // }

  async create(
    dto: CreatePaymentRequestDto,
    ipAddress: string,
    company: CompanyApiKey,
    apiKeyId: string,
  ): Promise<IPaymentResponse> {
    this.logger.log('Creating payment...');

    try {
      // await this.validateCreateSystemStatus();

      const provider = company[`provider_cashin_${dto.method.toLowerCase()}`];

      if (!provider) {
        throw new Error('No payment provider available');
      }

      if (dto.external_id) {
        const existing = await this.repository.findByExternalId(
          dto.external_id,
        );

        if (existing) {
          throw new HttpException(
            'Payment with this external_id already exists',
            HttpStatus.CONFLICT,
          );
        }
      }

      const haveSplits = false;

      const currencyEntity = new Currency(dto.currency);
      const companyEntity = new Company(company);
      const companyTaxConfig = companyEntity.getTaxConfigByCurrency(
        dto.currency,
      );

      this.validator.validatePaymentType(provider);
      currencyEntity.validatePaymentMethod(dto.method);
      const requiresDocument = currencyEntity.validateIfRequiresDocument(
        dto.customer.document ? dto.customer.document.type : undefined,
      );
      const paymentMethod = this.validator.validateMethod(dto.method);

      if (requiresDocument && dto.customer.document) {
        this.validator.validateDocument(dto.customer.document.number);
      }

      this.validator.validateAmount({
        amount: dto.amount,
        minValue:
          companyTaxConfig[`min_amount_sale_${dto.method.toLowerCase()}`],
        maxValue:
          companyTaxConfig[`max_amount_sale_${dto.method.toLowerCase()}`],
      });
      this.validator.validatePaymentItems(dto.amount, dto.items);

      if (dto.method === 'CREDIT_CARD') {
        this.validator.validateCreditCardPayment(dto.credit_card, dto.amount);
      } else {
        this.validator.validatePixAndBilletPayment(null);
      }

      const paymentId = UniqueIDGenerator.generate();

      const rates = this.feeCalculator.getTaxRates({
        company,
        method: paymentMethod,
        creditCard: dto.credit_card,
        companyTaxConfig,
      });
      const fees = this.feeCalculator.calculatePaymentFees({
        amount: dto.amount,
        rates,
      });
      this.validator.validatePaymentReserveDays(
        fees.amountReserve,
        companyTaxConfig[`available_days_reserve_${dto.method.toLowerCase()}`],
      );

      const { providerName, providerInstance } =
        await this.providerFactory.createProviderInstance(provider);

      const webhookUrl = `${WebhookConstants.WEBHOOK_BASE_URL}/${providerName.toLowerCase()}`;

      const providerInstanceResponse = await providerInstance.createPayment({
        amount: dto.amount,
        company,
        creditCard: dto.credit_card && {
          number: dto.credit_card.number,
          holder: dto.credit_card.holder_name,
          cvv: dto.credit_card.cvv,
          expMonth: dto.credit_card.expiry_month,
          expYear: dto.credit_card.expiry_year,
          installments: dto.credit_card.installments,
        },
        customer: {
          document: dto.customer.document
            ? dto.customer.document.number
            : undefined,
          name: dto.customer.name,
          email: dto.customer.email,
          phone: dto.customer.phone,
        },
        description: dto.description,
        myPaymentId: paymentId,
        paymentMethod,
        webhookUrl,
        checkoutUrl: dto.checkout_url,
        refererUrl: dto.referer_url,
      });

      this.validator.validateProviderResponse(
        providerInstanceResponse,
        dto.method,
      );

      const creditCardBrand = dto.credit_card
        ? CreditCardUtils.getCreditCardBrand(dto.credit_card.number)
        : null;

      const customer = await this.customerService.findOrCreate(
        dto.customer.email,
        {
          document: dto.customer.document
            ? dto.customer.document.number
            : undefined,
          fullName: dto.customer.name,
          phone: dto.customer.phone,
        },
      );

      const splitsJson = this.processor.createSplitsJsonForPayment(
        configAffiliates,
        configPartners,
        fees.amountCompany,
        haveSplits,
      );

      const paymentData = this.processor.buildPaymentData({
        company: {
          id: company.id,
          availableBilletInDays: companyTaxConfig.available_days_billet,
          availablePixInDays: companyTaxConfig.available_days_pix,
          availableReserveBilletInDays:
            companyTaxConfig.available_days_reserve_billet,
          availableReservePixInDays:
            companyTaxConfig.available_days_reserve_pix,
          availableReserveCreditCardInDays:
            companyTaxConfig.available_days_reserve_credit_card,
        },
        providerPaymentId: providerInstanceResponse.providerPaymentId,
        customerId: customer.data.id,
        creditCardBrand,
        company_api_key_id: apiKeyId,
        dto,
        fees,
        ipAddress,
        paymentId,
        paymentMethod,
        provider,
        providerResponse: providerInstanceResponse.providerResponse,
        rates,
        currency: dto.currency,
        haveSplits,
        splitsJson: splitsJson.splits,
      });

      const payment = await this.repository.create({
        ...paymentData,
      });

      if (payment.status === 'APPROVED') {
        await this.processor.createQueueTaskForApprovedPayment(
          payment.provider_payment_id,
          company.id,
          providerName,
          providerInstanceResponse.providerResponse,
        );
      }

      this.logger.log(`Payment ${payment.id} created successfully.`);

      return payment.toJSON();
    } catch (error) {
      this.logger.error(`Error creating payment: ${error.message}`);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || ERROR_MESSAGES.PAYMENT_FAILED,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async refund({
    companyId,
    ipAddress,
    paymentId,
  }: {
    paymentId: string;
    companyId: string;
    ipAddress: string;
  }): Promise<any> {
    try {
      // await this.validateRefundSystemStatus();

      const payment = await this.repository.findByIdAndComapnyWithProvider(
        paymentId,
        companyId,
      );

      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      const paymentEntity = new Payment(payment);

      if (!paymentEntity.canRefund()) {
        throw new HttpException(
          'Payment cannot be refunded in current status',
          HttpStatus.BAD_REQUEST,
        );
      }

      const { providerInstance } =
        await this.providerFactory.createProviderInstance(payment.provider);

      const providerResponse = await providerInstance.refundPayment({
        amount: payment.amount,
        myPaymentId: payment.id,
        providerPaymentId: payment.provider_payment_id,
        endToEndId: payment.end_to_end_id ?? undefined,
      });

      paymentEntity.markAsRefundedProcessing();
      paymentEntity.refunded_provider_log = providerResponse;
      paymentEntity.ips = paymentEntity.ips
        ? [...paymentEntity.ips, ipAddress]
        : [ipAddress];

      return (await this.repository.save(paymentEntity)).toJSON();
    } catch (error) {
      this.logger.error(`Error processing refund: ${error.message}`);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: ERROR_MESSAGES.REFUNDS_FAILED,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(page = 1, limit = 20, companyId: string): Promise<any> {
    try {
      const offset = (page - 1) * limit;
      const { data, total } = await this.repository.findAllWithCompany(
        companyId,
        offset,
        limit,
      );
      return {
        data,
        total,
        page,
        last_page: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Error finding payments: ${error.message}`);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: ERROR_MESSAGES.PAYMENT_NOT_FOUND,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findUnique(
    value: string,
    searchBy: string,
    companyId: string,
  ): Promise<IPaymentResponse> {
    let payment: Payment | null = null;

    try {
      switch (searchBy) {
        case 'id':
          payment = await this.repository.findByIdAndCompany(value, companyId);
          break;

        case 'external_id':
          payment = await this.repository.findByExternalIdWithCompany(
            value,
            companyId,
          );
          break;

        case 'end_to_end':
          payment = await this.repository.findByEndToEndIdWithCompany(
            value,
            companyId,
          );
          break;

        default:
          throw new HttpException(
            'Invalid search criteria',
            HttpStatus.BAD_REQUEST,
          );
      }

      if (!payment) {
        throw new HttpException(
          `Payment not found with ${searchBy}: ${value}`,
          HttpStatus.NOT_FOUND,
        );
      }

      return new Payment(payment).toJSON();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error finding payment by ${searchBy}: ${value}`,
        error,
      );
      throw new HttpException(
        'Error searching payment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
