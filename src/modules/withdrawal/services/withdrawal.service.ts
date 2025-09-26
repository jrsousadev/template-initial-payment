import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { WithdrawalRepository } from '../repositories/withdrawal.repository';
import { CreateWithdrawalDto } from '../dto/withdrawal.dto';
import { IWithdrawalResponse } from '../interfaces/withdrawal.interfaces';
import { Withdrawal } from '../entities/withdrawal.entity';
import { CompanyApiKey } from 'src/modules/payment/interfaces/transaction.interfaces';
import { Company } from 'src/modules/company/entities/company.entity';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { WithdrawalValidatorService } from './withdrawal-validator.service';
import { WithdrawalFeeCalculatorService } from './withdrawal-fee-calculator.service';
import { CompanyService } from 'src/modules/company/services/company.service';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { receiver_pix_type, receiver_type } from '@prisma/client';
import { InfractionService } from 'src/modules/infraction/services/infraction.service';
import { ReceiverService } from 'src/modules/receiver/services/receiver.service';

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  constructor(
    private readonly repository: WithdrawalRepository,
    private readonly validator: WithdrawalValidatorService,
    private readonly feeCalculator: WithdrawalFeeCalculatorService,
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
    private readonly receiverService: ReceiverService,
    private readonly infractionService: InfractionService,
  ) {}

  // private async validateWithdrawalSystemStatus() {
  //   const cached: any = await this.cacheManager.get('system_axis:123456');

  //   if (cached.all_cashouts_active === false) {
  //     throw new HttpException(
  //       {
  //         status: HttpStatus.BAD_REQUEST,
  //         message: 'Withdrawals are temporarily disabled',
  //       },
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }

  //   if (!cached) {
  //     await this.cacheManager.set(
  //       'system_axis:123456',
  //       { all_cashouts_active: true },
  //       300000,
  //     );
  //   }
  // }

  async create(
    dto: CreateWithdrawalDto,
    ipAddress: string,
    referer: string | null,
    userAgent: string | null,
    company: CompanyApiKey,
    apiKeyId: string,
  ): Promise<IWithdrawalResponse> {
    try {
      // await this.validateWithdrawalSystemStatus();

      if (!Number.isInteger(dto.amount)) {
        throw new BadRequestException('Amount must be an integer in cents');
      }

      if (!company.provider_cashout) {
        throw new BadRequestException(
          'Company does not have a cashout provider configured',
        );
      }

      if (dto.external_id) {
        const existing = await this.repository.findByExternalId(
          dto.external_id,
        );
        if (existing) {
          throw new ConflictException(
            'Withdrawal with this external_id already exists',
          );
        }
      }

      const companyId = company.id;
      const companyEntity = new Company(company);
      const companyTaxConfig = companyEntity.getTaxConfigByCurrency('BRL');
      const provider = company.provider_cashout;

      const receiver = await this.receiverService.findByIdAndCompany(
        dto.receiver_id,
        companyId,
      );

      if (!receiver) {
        throw new NotFoundException('Receiver not found');
      }

      receiver.validateForWithdrawal(dto.type, provider);
      this.validator.validateTypeWithdrawal(dto.type, provider);

      const withdrawalId = UniqueIDGenerator.generate();
      const balanceBlockedAdmin = company.balance_blocked ?? 0;

      // (TO DO) verificar se tem modulo de saque em cripto;

      this.validator.validateAmount({
        amount: dto.amount,
        maxValue: companyTaxConfig.max_withdrawal,
        minValue: companyTaxConfig.min_withdrawal,
      });

      const infractionsAmount =
        await this.infractionService.sumInfractionAmountByCompany(company.id);

      const companyTaxWithdrawal = companyTaxConfig.tax_rate_withdrawal;
      const companyTaxFeeWithdrawal = companyTaxConfig.tax_fee_withdrawal;
      const providerTaxWithdrawal =
        provider.provider_tax_config.tax_rate_withdrawal;
      const providerTaxFeeWithdrawal =
        provider.provider_tax_config.tax_fee_withdrawal;

      const fees = this.feeCalculator.calculateWithdrawalFees({
        amount: dto.amount,
        rates: {
          taxCompany: companyTaxWithdrawal,
          feeCompany: companyTaxFeeWithdrawal,
          taxProvider: providerTaxWithdrawal,
          feeProvider: providerTaxFeeWithdrawal,
        },
      });

      const taxWithdrawalAmount = fees.amountOrganization + fees.amountProvider;
      const amountWithFees =
        dto.amount +
        taxWithdrawalAmount +
        balanceBlockedAdmin +
        infractionsAmount;

      const walletBalance = await this.companyService.getBalances(
        companyId,
        'BRL',
      );

      if (!walletBalance) {
        throw new BadRequestException('Insufficient balance for withdrawal');
      }

      if (
        walletBalance.balances[0].balances_by_account.BALANCE_AVAILABLE <
        amountWithFees
      ) {
        throw new BadRequestException('Insufficient balance for withdrawal');
      }

      const withdrawal = await this.repository.create(
        {
          id: withdrawalId,
          external_id: dto.external_id || null,

          company: {
            connect: { id: companyId },
          },
          amount: dto.amount,
          amount_fee: taxWithdrawalAmount,
          amount_organization: fees.amountOrganization,
          amount_provider: fees.amountProvider,

          bank_account_check_digit: receiver.bank_account_check_digit,
          bank_account_number: receiver.bank_account_number,
          bank_account_type: receiver.bank_account_type,
          bank_branch_check_digit: receiver.bank_branch_check_digit,
          bank_branch_code: receiver.bank_branch_code,
          bank_code: receiver.bank_code,

          user_agent: userAgent,
          referer_url: referer,
          ip: ipAddress,

          pix_key: receiver.pix_key,
          pix_key_type: receiver.pix_type,

          creditor_document: receiver.bank_holder_document,
          creditor_name: receiver.bank_holder_name,

          wallet_address: receiver.wallet_id,
          wallet_network: receiver.wallet_network,

          provider: {
            connect: { id: provider.id },
          },
          provider_name: provider.name,
          receiver: {
            connect: { id: receiver.id },
          },
          status: 'PENDING',
          total_amount: amountWithFees,
          withdrawal_type: dto.type,

          api_key: {
            connect: { id: apiKeyId },
          },
        },
        true,
      );

      const withdrawalEntity = new Withdrawal(withdrawal);

      const payload: {
        withdrawalId: string;
        receiverType: receiver_type;
        pixType: receiver_pix_type;
        pixKey: string;
        receiverDocument: string;
        type: receiver_type;
      } = {
        withdrawalId: withdrawal.id,
        receiverType: receiver.type,
        pixType: receiver.pix_type as receiver_pix_type,
        pixKey: receiver.pix_key as string,
        receiverDocument: receiver.bank_holder_document as string,
        type: receiver.type,
      };

      if (company.company_config.automatic_withdrawal_enabled) {
        await this.prisma.queue
          .create({
            data: {
              id: UniqueIDGenerator.generate(),
              type: 'CALL_PROVIDER_WITHDRAWAL',
              company_id: company.id,
              payload,
              withdrawal_id: withdrawal.id,
              description: provider.name.toUpperCase(),
            },
          })
          .catch((err) => {
            console.error(
              `Failed to enqueue automatic withdrawal processing for withdrawal ID ${withdrawalId}: ${err.message}`,
            );
          });
      }

      return withdrawalEntity.toJSON();
    } catch (error) {
      throw error;
    }
  }

  async findUnique(
    value: string,
    searchBy: string,
    companyId: string,
  ): Promise<IWithdrawalResponse> {
    let withdrawal: Withdrawal | null = null;

    try {
      switch (searchBy) {
        case 'id':
          withdrawal = await this.repository.findByIdAndCompany(
            value,
            companyId,
          );
          break;

        case 'external_id':
          withdrawal = await this.repository.findByExternalIdAndCompany(
            value,
            companyId,
          );
          break;

        case 'end_to_end':
          withdrawal = await this.repository.findByEndToEndIdAndCompany(
            value,
            companyId,
          );
          break;

        default:
          throw new BadRequestException('Invalid search criteria');
      }

      if (!withdrawal) {
        throw new NotFoundException(
          `Withdrawal not found with ${searchBy}: ${value}`,
        );
      }

      return withdrawal.toJSON();
    } catch (error) {
      throw error;
    }
  }

  async findAll(page = 1, limit = 20, companyId: string): Promise<any> {
    try {
      const offset = (page - 1) * limit;
      const { data, total } = await this.repository.findAllByCompany(
        companyId,
        offset,
        limit,
      );

      return {
        data: data.map((w) => w.toJSON()),
        total,
        page,
        last_page: Math.ceil(total / limit),
      };
    } catch (error) {
      throw error;
    }
  }
}
