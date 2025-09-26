// provider.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  ProviderTaxConfigRepository,
  ProviderSubAccountRepository,
} from '../repositories/provider-tax-config.repository';
import { ProviderRepository } from '../repositories/provider.repository';
import {
  AssignProviderToCompanyDto,
  CreateProviderDto,
  CreateProviderTaxConfigDto,
  CreateSubAccountDto,
  UpdateProviderDto,
  UpdateProviderTaxConfigDto,
} from '../dto/provider.dto';
import { encryptionHelper } from 'src/common/utils/encryption.util';
import { v4 } from 'uuid';
import { CompanyService } from 'src/modules/company/services/company.service';

@Injectable()
export class ProviderService {
  constructor(
    private readonly repository: ProviderRepository,
    private readonly providerTaxConfigRepository: ProviderTaxConfigRepository,
    private readonly providerSubAccountRepository: ProviderSubAccountRepository,
    private readonly companyService: CompanyService,
  ) {}

  async create(createProviderDto: CreateProviderDto) {
    // Criptografa as chaves sensíveis
    const encryptedData = {
      ...createProviderDto,
      secret_key_cashin: createProviderDto.secret_key_cashin
        ? encryptionHelper.encrypt(createProviderDto.secret_key_cashin)
        : null,
      public_key_cashin: createProviderDto.public_key_cashin
        ? encryptionHelper.encrypt(createProviderDto.public_key_cashin)
        : null,
      secret_key_cashout: createProviderDto.secret_key_cashout
        ? encryptionHelper.encrypt(createProviderDto.secret_key_cashout)
        : null,
      public_key_cashout: createProviderDto.public_key_cashout
        ? encryptionHelper.encrypt(createProviderDto.public_key_cashout)
        : null,
    };

    const providerId = v4();

    // Cria o provider
    const provider = await this.repository.create({
      id: providerId,
      ...encryptedData,
    });

    // Cria configuração de taxas padrão COMPLETA

    await this.createTaxConfig(providerId, {
      // Cash-in
      tax_rate_pix: 0.5,
      tax_fee_pix: 0,
      tax_rate_billet: 1.99,
      tax_fee_billet: 199,
      tax_fee_credit_card: 249,

      // MED PIX
      tax_rate_dispute_pix: 0.25,
      tax_fee_dispute_pix: 50,

      // Refunds
      tax_rate_refund_pix: 0,
      tax_fee_refund_pix: 0,
      tax_rate_refund_billet: 0,
      tax_fee_refund_billet: 0,
      tax_rate_refund_credit_card: 0,
      tax_fee_refund_credit_card: 0,

      // Chargeback
      tax_rate_chargeback_credit_card: 3.5,
      tax_fee_chargeback_credit_card: 1500,
      tax_rate_dispute_credit_card: 2.0,
      tax_fee_dispute_credit_card: 1000,
      tax_rate_pre_chargeback_credit_card: 1.0,
      tax_fee_pre_chargeback_credit_card: 500,

      // Withdrawal
      tax_rate_withdrawal: 0.3,
      tax_fee_withdrawal: 99,

      // CC Installments (2x até 12x)
      tax_rate_installments_credit_card: [
        2.89, 3.39, 3.89, 4.39, 4.89, 5.39, 5.89, 6.39, 6.89, 7.39, 7.89,
      ],
    });

    return {
      id: provider.id,
      name: provider.name,
      model: provider.model,
      environment: provider.environment,
      mode: provider.mode,
      type: provider.type,
      pix_enabled: provider.pix_enabled,
      billet_enabled: provider.billet_enabled,
      credit_card_enabled: provider.credit_card_enabled,
      is_active: provider.is_active,
      created_at: provider.created_at,
    };
  }

  async findAll() {
    const providers = await this.repository.findAll();

    return {
      total: providers.length,
      providers: providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        model: provider.model,
        environment: provider.environment,
        mode: provider.mode,
        type: provider.type,
        is_active: provider.is_active,
        pix_enabled: provider.pix_enabled,
        billet_enabled: provider.billet_enabled,
        credit_card_enabled: provider.credit_card_enabled,
        has_tax_config: !!provider.provider_tax_config,
        created_at: provider.created_at,
      })),
    };
  }

  async findById(id: string) {
    const provider = await this.repository.findById(id);

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    return {
      id: provider.id,
      name: provider.name,
      model: provider.model,
      environment: provider.environment,
      mode: provider.mode,
      type: provider.type,
      description: provider.description,
      pix_enabled: provider.pix_enabled,
      billet_enabled: provider.billet_enabled,
      credit_card_enabled: provider.credit_card_enabled,
      pix_key: provider.pix_key,
      base_url: provider.base_url,
      receiver_id: provider.receiver_id,
      is_active: provider.is_active,
      tax_config: provider.provider_tax_config,
      sub_accounts_count: provider.provider_sub_accounts?.length || 0,
      created_at: provider.created_at,
      updated_at: provider.updated_at,
    };
  }

  async update(id: string, updateProviderDto: UpdateProviderDto) {
    const provider = await this.repository.findById(id);

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    // Criptografa as chaves se foram fornecidas
    const updateData: any = { ...updateProviderDto };

    if (updateData.secret_key_cashin) {
      updateData.secret_key_cashin = encryptionHelper.encrypt(
        updateData.secret_key_cashin,
      );
    }
    if (updateData.public_key_cashin) {
      updateData.public_key_cashin = encryptionHelper.encrypt(
        updateData.public_key_cashin,
      );
    }
    if (updateData.secret_key_cashout) {
      updateData.secret_key_cashout = encryptionHelper.encrypt(
        updateData.secret_key_cashout,
      );
    }
    if (updateData.public_key_cashout) {
      updateData.public_key_cashout = encryptionHelper.encrypt(
        updateData.public_key_cashout,
      );
    }

    const updated = await this.repository.update(id, updateData);

    return {
      id: updated.id,
      name: updated.name,
      is_active: updated.is_active,
      updated_at: updated.updated_at,
    };
  }

  async delete(id: string) {
    const provider = await this.repository.findById(id);

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    await this.repository.delete(id);

    return {
      message: 'Provider deactivated successfully',
    };
  }

  // ========== TAX CONFIG METHODS ==========

  async getTaxConfig(providerId: string) {
    const taxConfig =
      await this.providerTaxConfigRepository.findByProviderId(providerId);

    if (!taxConfig) {
      throw new NotFoundException(
        'Tax configuration not found for this provider',
      );
    }

    return taxConfig;
  }

  async createTaxConfig(
    providerId: string,
    createTaxConfigDto: CreateProviderTaxConfigDto,
  ) {
    const provider = await this.repository.findById(providerId);

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    // Verifica se já existe configuração
    const existing =
      await this.providerTaxConfigRepository.findByProviderId(providerId);

    if (existing) {
      throw new ConflictException(
        'Tax configuration already exists for this provider',
      );
    }

    const taxConfig = await this.providerTaxConfigRepository.create({
      ...createTaxConfigDto,
      provider: {
        connect: { id: providerId },
      },
    });

    return taxConfig;
  }

  async updateTaxConfig(
    providerId: string,
    updateTaxConfigDto: UpdateProviderTaxConfigDto,
  ) {
    const provider = await this.repository.findById(providerId);
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const taxConfig =
      await this.providerTaxConfigRepository.findByProviderId(providerId);

    if (!taxConfig) {
      throw new NotFoundException('Tax configuration not found');
    }

    return this.providerTaxConfigRepository.update(
      taxConfig.id,
      updateTaxConfigDto,
    );
  }

  // ========== SUB-ACCOUNT METHODS ==========

  async createSubAccount(
    providerId: string,
    companyId: string,
    createSubAccountDto: CreateSubAccountDto,
  ) {
    // Verifica se provider existe
    const provider = await this.repository.findById(providerId);
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    // Verifica se empresa existe
    const company = await this.companyService.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Verifica se já existe sub-conta
    const existing =
      await this.providerSubAccountRepository.findByCompanyAndProvider(
        companyId,
        providerId,
      );

    if (existing) {
      throw new ConflictException(
        'Sub-account already exists for this company/provider',
      );
    }

    // Criptografa as chaves
    const encryptedData = {
      ...createSubAccountDto,
      public_key: createSubAccountDto.public_key
        ? encryptionHelper.encrypt(createSubAccountDto.public_key)
        : null,
      secret_key: createSubAccountDto.secret_key
        ? encryptionHelper.encrypt(createSubAccountDto.secret_key)
        : null,
    };

    const subAccount = await this.providerSubAccountRepository.create({
      ...encryptedData,
      provider: {
        connect: { id: providerId },
      },
      company: {
        connect: { id: companyId },
      },
    });

    return {
      id: subAccount.id,
      receiver_id: subAccount.receiver_id,
      account_id: subAccount.account_id,
      provider_name: subAccount.provider.name,
      company_name: subAccount.company.name,
      created_at: subAccount.created_at,
    };
  }

  async getSubAccount(providerId: string, companyId: string) {
    const subAccount =
      await this.providerSubAccountRepository.findByCompanyAndProvider(
        companyId,
        providerId,
      );

    if (!subAccount) {
      throw new NotFoundException('Sub-account not found');
    }

    return {
      id: subAccount.id,
      receiver_id: subAccount.receiver_id,
      account_id: subAccount.account_id,
      provider_name: subAccount.provider.name,
      created_at: subAccount.created_at,
    };
  }

  // ========== COMPANY ASSIGNMENT METHODS ==========

  async assignProviderToCompany(
    companyId: string,
    assignDto: AssignProviderToCompanyDto,
  ) {
    // Verifica se empresa existe
    const company = await this.companyService.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Verifica se provider existe
    const provider = await this.repository.findById(assignDto.provider_id);
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    // Atualiza as relações baseadas no tipo
    const updateData: any = {};

    if (assignDto.cashin_pix) {
      updateData.provider_cashin_pix_id = assignDto.provider_id;
    }
    if (assignDto.cashin_credit_card) {
      updateData.provider_cashin_credit_card_id = assignDto.provider_id;
    }
    if (assignDto.cashin_billet) {
      updateData.provider_cashin_billet_id = assignDto.provider_id;
    }
    if (assignDto.cashout) {
      updateData.provider_cashout_id = assignDto.provider_id;
    }

    await this.companyService.updateProvidersInCompany(companyId, updateData);

    return {
      message: 'Provider assigned to company successfully',
      company_id: companyId,
      provider_id: assignDto.provider_id,
      assignments: {
        cashin_pix: assignDto.cashin_pix || false,
        cashin_credit_card: assignDto.cashin_credit_card || false,
        cashin_billet: assignDto.cashin_billet || false,
        cashout: assignDto.cashout || false,
      },
    };
  }

  async getProvidersByCompany(companyId: string) {
    const company = await this.companyService.findById(companyId);

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const subAccounts =
      await this.providerSubAccountRepository.findByCompany(companyId);

    return {
      company_id: companyId,
      providers: {
        cashin_pix: company.provider_cashin_pix_id,
        cashin_credit_card: company.provider_cashin_credit_card_id,
        cashin_billet: company.provider_cashin_billet_id,
        cashout: company.provider_cashout_id,
      },
      sub_accounts: subAccounts.map((sa) => ({
        id: sa.id,
        provider_name: sa.provider.name,
        receiver_id: sa.receiver_id,
        account_id: sa.account_id,
        created_at: sa.created_at,
      })),
    };
  }
}
