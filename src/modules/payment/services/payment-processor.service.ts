import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import {
  $Enums,
  customer_document_type,
  payment_available_status,
  payment_credit_card_brand,
  payment_method,
  payment_reserve_available_status,
  provider,
  provider_name,
  transaction_currency,
} from '@prisma/client';
import { DocumentValidator } from 'src/common/utils/document.util';
import { PaymentFees, TaxRates } from '../interfaces/transaction.interfaces';
import { CreatePaymentRequestDto } from '../dto/payment.dto';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { PaymentWebhookData } from 'src/infrastructure/gateways/base-payment.provider';

@Injectable()
export class PaymentProcessorService {
  constructor(private prisma: PrismaService) {}

  buildPaymentData({
    company,
    company_api_key_id,
    creditCardBrand,
    dto,
    fees,
    ipAddress,
    paymentId,
    paymentMethod,
    provider,
    providerResponse,
    rates,
    currency,
    customerId,
    providerPaymentId,
  }: {
    paymentId: string;
    dto: CreatePaymentRequestDto;
    providerPaymentId: string;
    company: {
      id: string;
      availableReserveCreditCardInDays: number;
      availablePixInDays: number;
      availableBilletInDays: number;
      availableReservePixInDays: number;
      availableReserveBilletInDays: number;
    };
    customerId: string;
    provider: provider;
    fees: PaymentFees;
    rates: TaxRates;
    paymentMethod: payment_method;
    ipAddress: string;
    creditCardBrand: payment_credit_card_brand | null;
    providerResponse: any;
    company_api_key_id: string;
    currency: transaction_currency;
  }) {
    let availableStatus: payment_available_status = 'COMPLETED';
    let completedAvailableDate: Date | null = new Date();

    let availableReserveStatus: payment_reserve_available_status = 'COMPLETED';
    let completedAvailableReserveDate: Date | null = new Date();

    switch (dto.method) {
      case 'CREDIT_CARD':
        availableStatus = 'PARTIAL';
        completedAvailableDate = null;

        availableReserveStatus =
          company.availableReserveCreditCardInDays > 0
            ? 'PARTIAL'
            : 'COMPLETED';

        completedAvailableReserveDate =
          company.availableReserveCreditCardInDays > 0
            ? new Date(
                new Date().setDate(
                  new Date().getDate() +
                    company.availableReserveCreditCardInDays,
                ),
              )
            : null;
        break;

      case 'PIX':
        availableStatus =
          company.availablePixInDays > 0 ? 'PARTIAL' : 'COMPLETED';
        completedAvailableDate =
          company.availablePixInDays > 0
            ? new Date(
                new Date().setDate(
                  new Date().getDate() + company.availablePixInDays,
                ),
              )
            : null;

        availableReserveStatus =
          company.availableReservePixInDays > 0 ? 'PARTIAL' : 'COMPLETED';

        completedAvailableReserveDate =
          company.availableReservePixInDays > 0
            ? new Date(
                new Date().setDate(
                  new Date().getDate() + company.availableReservePixInDays,
                ),
              )
            : null;

        break;

      case 'BILLET':
        availableStatus =
          company.availableBilletInDays > 0 ? 'PARTIAL' : 'COMPLETED';
        completedAvailableDate =
          company.availableBilletInDays > 0
            ? new Date(
                new Date().setDate(
                  new Date().getDate() + company.availableBilletInDays,
                ),
              )
            : null;

        availableReserveStatus =
          company.availableReserveBilletInDays > 0 ? 'PARTIAL' : 'COMPLETED';
        completedAvailableReserveDate =
          company.availableReserveBilletInDays > 0
            ? new Date(
                new Date().setDate(
                  new Date().getDate() + company.availableReserveBilletInDays,
                ),
              )
            : null;
        break;

      default:
        throw new Error('Unsupported payment method');
    }

    const status = providerResponse.status as $Enums.payment_status;

    const baseData = {
      id: paymentId,
      provider_payment_id: providerPaymentId,
      external_id: dto.external_id || null,
      currency,

      description: dto.description || null,

      items_json: dto.items as any[],
      payment_items: dto.items as any[],

      amount: dto.amount,
      amount_fee: fees.totalFees,
      amount_provider: fees.amountProvider,
      amount_organization: fees.amountOrganization,
      amount_net: fees.amountCompany,
      amount_reserve: fees.amountReserve,

      tax_fee_company: rates.feeCompany,
      tax_fee_reserve_company: rates.feeReserveCompany,

      tax_rate_company: rates.taxCompany,
      tax_rate_reserve_company: rates.taxReserveCompany,

      tax_fee_provider: rates.feeProvider,
      tax_rate_provider: rates.taxProvider,

      customer_id: customerId,

      ...(dto.address && {
        address_zipcode: dto.address.zipcode,
        address_city: dto.address.city,
        address_state: dto.address.state,
        address_complement: dto.address.complement,
        address_street: dto.address.street,
        address_district: dto.address.district,
        address_number: dto.address.number,
        address_country: dto.address.country,
      }),

      customer_name: dto.customer.name,
      customer_document: dto.customer.document
        ? this.formatDocument(dto.customer.document.number)
        : null,
      customer_email: this.formatEmail(dto.customer.email),
      customer_phone: this.formatPhone(dto.customer.phone),
      customer_document_type: dto.customer.document
        ? (dto.customer.document.type as customer_document_type)
        : null,

      status,
      method: paymentMethod,

      approve_provider_log:
        status === $Enums.payment_status.APPROVED ? providerResponse : null,

      checkout_url: dto.checkout_url || null,
      referer_url: dto.referer_url || null,
      error_message: providerResponse.error_message || null,

      available_status: availableStatus,
      completed_available_date: completedAvailableDate,
      available_reserve_status: availableReserveStatus,
      completed_reserve_available_date: completedAvailableReserveDate,

      ips: [ipAddress],

      provider_name: provider.name || 'DEFAULT_PROVIDER',

      company_id: company.id,
      company_api_key_id: company_api_key_id,
      provider_id: provider.id,
    };

    if (dto.method === 'PIX' && 'pixCode' in providerResponse) {
      return {
        ...baseData,
        pix_code: providerResponse.pixCode,
        expired_at: providerResponse.expiresAt,
      };
    }

    if (
      dto.method === 'CREDIT_CARD' &&
      'authCodeCreditCard' in providerResponse
    ) {
      const creditCard = dto.credit_card!;
      return {
        ...baseData,

        installments: creditCard.installments,
        installments_qty_received: 0,
        installments_amount_received: 0,
        installments_amount_pending: Math.floor(
          fees.amountCompany - fees.amountReserve,
        ),
        amount_per_installments: Math.floor(
          (fees.amountCompany - fees.amountReserve) / creditCard.installments,
        ),

        brand_credit_card: creditCardBrand,
        bin_credit_card: creditCard.number.slice(0, 6),
        last_four_digits_credit_card: creditCard.number.slice(-4),
        auth_code_credit_card: providerResponse.authCodeCreditCard,
      };
    }

    return {
      ...baseData,
      billet_url: providerResponse.billetUrl,
      billet_barcode: providerResponse.billetBarcode,
    };
  }

  formatDocument(documentBody: string): string {
    return DocumentValidator.clean(documentBody);
  }

  formatPhone(phoneBody: string): string {
    return phoneBody.replace(/\D/g, '');
  }

  formatResponsibleDocument(responsibleDocument: string): string {
    return responsibleDocument.replace(/\D/g, '');
  }

  formatEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async createQueueTaskForApprovedPayment(
    providerPaymentId: string,
    companyId: string,
    providerName: provider_name,
    providerResponse: any,
  ) {
    setImmediate(() => {
      const payload: PaymentWebhookData = {
        providerPaymentId,
        type: 'PAYMENT',
        webhookStatus: 'APPROVED',
        providerResponse,
      };

      this.prisma.queue
        .create({
          data: {
            id: UniqueIDGenerator.generate(),
            company_id: companyId,
            payload: payload as any,
            type: 'PAYMENT',
            description: providerName.toUpperCase(),
          },
        })
        .catch((error) => {
          console.error('[ERROR] Failed to create queue task:', error);
        });
    });
  }
}
