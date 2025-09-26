// company.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
  transaction_account_type,
  transaction_currency,
} from '@prisma/client';
import { S3Service } from 'src/infrastructure/aws/s3/s3.service';
import { WalletService } from 'src/modules/wallet/services/wallet.service';
import { v4 } from 'uuid';
import {
  CreateCompanyDto,
  UpdateCompanyConfigDto,
  UpdateCompanyTaxConfigDto,
  UploadCompanyDocumentsDto,
} from '../dto/company.dto';
import { CompanyConfigRepository } from '../repositories/company-config.repository';
import { CompanyDocumentRepository } from '../repositories/company-document.repository';
import { CompanyTaxConfigRepository } from '../repositories/company-tax-config.repository';
import { CompanyRepository } from '../repositories/company.repository';

@Injectable()
export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly companyTaxConfigRepository: CompanyTaxConfigRepository,
    private readonly companyConfigRepository: CompanyConfigRepository,
    private readonly companyDocumentRepository: CompanyDocumentRepository,
    private readonly walletService: WalletService,
    private readonly s3Service: S3Service,
  ) {}

  private isValidCNPJ(cnpj: string): boolean {
    const cleanCNPJ = cnpj.replace(/\D/g, '');

    if (cleanCNPJ.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;

    return true; // Simplificado
  }

  private getFileExtension(mimetype: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'application/pdf': 'pdf',
    };
    return extensions[mimetype] || 'jpg';
  }

  async create(createCompanyDto: CreateCompanyDto) {
    // Validações...
    const existingDocument = await this.companyRepository.findByDocument(
      createCompanyDto.document,
    );
    if (existingDocument) {
      throw new ConflictException('CNPJ already registered');
    }

    const existingEmail = await this.companyRepository.findByEmail(
      createCompanyDto.email,
    );
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    if (!this.isValidCNPJ(createCompanyDto.document)) {
      throw new BadRequestException('Invalid CNPJ');
    }

    const companyId = v4();

    // Cria a empresa
    const company = await this.companyRepository.create({
      id: companyId,
      name: createCompanyDto.name,
      email: createCompanyDto.email.toLowerCase(),
      document: createCompanyDto.document,
      status: 'AWAITING_DOCUMENTS',
      balance_blocked: 0,
      address_street: createCompanyDto.address_street || '',
      address_street_number: createCompanyDto.address_street_number || '',
      address_cep: createCompanyDto.address_cep || '',
      address_city: createCompanyDto.address_city || '',
      address_state: createCompanyDto.address_state || '',
      address_neighborhood: createCompanyDto.address_neighborhood || '',
      soft_descriptor:
        createCompanyDto.soft_descriptor ||
        createCompanyDto.name.substring(0, 13),
    });

    // Cria configuração de taxas COMPLETA padrão para BRL
    await this.companyTaxConfigRepository.create({
      company: { connect: { id: companyId } },
      currency: 'BRL',

      // Taxas cash-in
      tax_rate_pix: 0.99,
      tax_rate_billet: 2.99,
      tax_fee_pix: 0,
      tax_fee_credit_card: 299,
      tax_fee_billet: 299,

      // Reembolso
      tax_rate_refund_pix: 0,
      tax_rate_refund_credit_card: 0,
      tax_rate_refund_billet: 0,
      tax_fee_refund_pix: 0,
      tax_fee_refund_credit_card: 0,
      tax_fee_refund_billet: 0,

      // MED/Disputa PIX
      tax_rate_dispute_pix: 0.5,
      tax_fee_dispute_pix: 100,

      // Chargeback
      tax_rate_chargeback_credit_card: 5.0,
      tax_fee_chargeback_credit_card: 2500,
      tax_rate_dispute_credit_card: 2.5,
      tax_fee_dispute_credit_card: 1500,
      tax_rate_pre_chargeback_credit_card: 1.5,
      tax_fee_pre_chargeback_credit_card: 1000,

      // Antecipação
      tax_rate_anticipation: 2.99,
      tax_fee_anticipation: 0,

      // Reserva
      tax_rate_reserve_credit_card: 5.0,
      tax_rate_reserve_billet: 3.0,
      tax_rate_reserve_pix: 2.0,
      tax_fee_reserve_credit_card: 0,
      tax_fee_reserve_billet: 0,
      tax_fee_reserve_pix: 0,

      // Parcelas (2x até 12x)
      tax_rate_installments_credit_card: [
        3.56, 4.13, 4.13, 4.13, 4.13, 4.13, 4.46, 4.46, 4.46, 4.46, 4.46,
      ],

      // Dias disponíveis
      available_days_pix: 1,
      available_days_billet: 2,
      available_days_anticipation: 30,
      available_days_reserve_pix: 30,
      available_days_reserve_credit_card: 30,
      available_days_reserve_billet: 30,

      // Limites min/max vendas
      min_amount_sale_pix: 100,
      min_amount_sale_credit_card: 100,
      min_amount_sale_billet: 500,
      max_amount_sale_pix: 10000000,
      max_amount_sale_credit_card: 5000000,
      max_amount_sale_billet: 10000000,

      // Config withdrawal
      min_withdrawal: 100,
      max_withdrawal: 10000000,

      // Tax withdrawal
      tax_rate_withdrawal: 0.5,
      tax_fee_withdrawal: 199,
    });

    // Cria configuração padrão (tudo true, exceto automatics)
    await this.companyConfigRepository.create({
      company: { connect: { id: companyId } },
      automatic_anticipation_enabled: false,
      automatic_withdrawal_enabled: false,
      withdrawal_enabled: true,
      payment_enabled: true,
      payment_link_enabled: true,
      payment_credit_card_enabled: true,
      payment_pix_enabled: true,
      payment_billet_enabled: true,
    });

    await this.walletService.createWallet(companyId);

    return company;
  }

  async uploadDocuments(
    companyId: string,
    documentsDto: UploadCompanyDocumentsDto,
    files: Record<string, any>,
  ) {
    // Verifica se a empresa existe
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Verifica se já tem documentos
    const existingDocuments =
      await this.companyDocumentRepository.findByCompanyId(companyId);
    if (existingDocuments) {
      throw new ConflictException('Documents already uploaded');
    }

    // Validação dos arquivos obrigatórios
    const requiredFiles = [
      'contract_social',
      'card_cnpj',
      'document_front_responsible',
      'document_back_responsible',
      'document_selfie_responsible',
    ];

    for (const fileName of requiredFiles) {
      if (!files[fileName]) {
        throw new BadRequestException(`File ${fileName} is required`);
      }
    }

    // Upload dos arquivos com tratamento de erro individual
    const uploadResults: Record<string, string> = {};

    try {
      for (const fileName of requiredFiles) {
        const file = files[fileName];
        const url = await this.s3Service.uploadBuffer(
          file.buffer,
          `companies/${companyId}/${fileName}.${this.getFileExtension(file.mimetype)}`,
          file.mimetype,
        );
        uploadResults[fileName] = url;
      }
    } catch (error) {
      console.error('Error uploading files to S3:', error);
      throw new BadRequestException('Failed to upload documents');
    }

    // Cria registro de documentos
    const companyDocument = await this.companyDocumentRepository.create({
      company: { connect: { id: companyId } },
      contract_social_url: uploadResults.contract_social,
      card_cnpj_url: uploadResults.card_cnpj,
      document_front_responsible_url: uploadResults.document_front_responsible,
      document_back_responsible_url: uploadResults.document_back_responsible,
      document_selfie_responsible_url:
        uploadResults.document_selfie_responsible,
      mother_name_responsible: documentsDto.mother_name_responsible,
      phone_responsible: documentsDto.phone_responsible,
      document_responsible: documentsDto.document_responsible,
      name_responsible: documentsDto.name_responsible,
      cnae_company: documentsDto.cnae_company,
      phone_company: documentsDto.phone_company,
      website_company: documentsDto.website_company || '',
      created_company_date: new Date(documentsDto.created_company_date),
      average_ticket: documentsDto.average_ticket || 0,
      monthly_revenue: documentsDto.monthly_revenue || 0,
    });

    // Atualiza status da empresa para ACTIVE
    await this.companyRepository.update(companyId, {
      status: 'ACTIVE',
    });

    return companyDocument;
  }

  async findById(companyId: string) {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async findByIdWithWallets(companyId: string) {
    const company = await this.companyRepository.findByIdWithWallets(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async findByIdCompleted(companyId: string) {
    const company = await this.companyRepository.findByIdCompleted(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async updateProvidersInCompany(
    companyId: string,
    updatedData: Prisma.companyUpdateArgs['data'],
  ) {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    await this.companyRepository.update(companyId, updatedData);
  }

  // ========== TAX CONFIG METHODS ==========

  async getTaxConfig(
    companyId: string,
    currency: transaction_currency = 'BRL',
  ) {
    const taxConfig =
      await this.companyTaxConfigRepository.findByCompanyTaxConfigByCurrency(
        companyId,
        currency,
      );

    if (!taxConfig) {
      throw new NotFoundException(
        `Tax configuration not found for currency ${currency}`,
      );
    }

    return taxConfig;
  }

  async getAllTaxConfigs(companyId: string) {
    const taxConfigs =
      await this.companyTaxConfigRepository.findAllByCompanyId(companyId);

    if (!taxConfigs || taxConfigs.length === 0) {
      throw new NotFoundException('No tax configurations found');
    }

    return taxConfigs;
  }

  async updateTaxConfig(
    companyId: string,
    updateTaxConfigDto: UpdateCompanyTaxConfigDto,
  ) {
    const currency = updateTaxConfigDto.currency;
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    this.validatePaymentMethodReserveDays(
      'billet',
      updateTaxConfigDto.tax_fee_reserve_billet || 0,
      updateTaxConfigDto.tax_rate_reserve_billet || 0,
      updateTaxConfigDto.available_days_reserve_billet || 0,
    );

    this.validatePaymentMethodReserveDays(
      'credit_card',
      updateTaxConfigDto.tax_fee_reserve_credit_card || 0,
      updateTaxConfigDto.tax_rate_reserve_credit_card || 0,
      updateTaxConfigDto.available_days_reserve_credit_card || 0,
    );

    this.validatePaymentMethodReserveDays(
      'pix',
      updateTaxConfigDto.tax_fee_reserve_pix || 0,
      updateTaxConfigDto.tax_rate_reserve_pix || 0,
      updateTaxConfigDto.available_days_reserve_pix || 0,
    );

    // Usa o método updateByCompanyIdAndCurrency que já faz upsert
    const updated =
      await this.companyTaxConfigRepository.updateByCompanyIdAndCurrency(
        companyId,
        currency,
        updateTaxConfigDto,
      );

    return updated;
  }

  async createTaxConfig(
    companyId: string,
    createTaxConfigDto: UpdateCompanyTaxConfigDto,
  ) {
    const currency = createTaxConfigDto.currency;

    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Verifica se já existe configuração para esta moeda
    const existingConfig =
      await this.companyTaxConfigRepository.findByCompanyTaxConfigByCurrency(
        companyId,
        currency,
      );

    if (existingConfig) {
      throw new ConflictException(
        `Tax configuration already exists for currency ${currency}`,
      );
    }

    const created = await this.companyTaxConfigRepository.create({
      company: { connect: { id: companyId } },
      ...createTaxConfigDto,
    });

    return created;
  }

  // ========== COMPANY CONFIG METHODS ==========

  async getConfig(companyId: string) {
    const config =
      await this.companyConfigRepository.findByCompanyId(companyId);

    if (!config) {
      throw new NotFoundException('Company configuration not found');
    }

    return config;
  }

  async updateConfig(
    companyId: string,
    updateConfigDto: UpdateCompanyConfigDto,
  ) {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const config =
      await this.companyConfigRepository.findByCompanyId(companyId);
    if (!config) {
      throw new NotFoundException('Company configuration not found');
    }

    const updated = await this.companyConfigRepository.update(
      config.id,
      updateConfigDto,
    );

    return updated;
  }

  async createConfig(
    companyId: string,
    createConfigDto: UpdateCompanyConfigDto,
  ) {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const existingConfig =
      await this.companyConfigRepository.findByCompanyId(companyId);
    if (existingConfig) {
      throw new ConflictException('Company configuration already exists');
    }

    const created = await this.companyConfigRepository.create({
      company: { connect: { id: companyId } },
      ...createConfigDto,
    });

    return created;
  }

  // ========== OTHER METHODS ==========

  async getBalances(companyId: string, currency?: transaction_currency) {
    const company = await this.companyRepository.findByIdWithWallets(companyId);

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Filtra wallets por currency se especificado
    let wallets = company.wallets || [];

    if (currency) {
      wallets = wallets.filter((w) => w.currency === currency);
    }

    // Agrupa saldos por currency
    const balancesByCurrency = wallets.reduce(
      (acc, wallet) => {
        if (!acc[wallet.currency]) {
          acc[wallet.currency] = {
            currency: wallet.currency,
            total_balance: 0,
            balances_by_account: {
              BALANCE_RESERVE: 0,
              BALANCE_AVAILABLE: 0,
              BALANCE_PENDING: 0,
            },
          };
        }

        acc[wallet.currency].total_balance += wallet.balance;
        acc[wallet.currency].balances_by_account[wallet.account_type] =
          wallet.balance;

        return acc;
      },
      {} as Record<
        string,
        {
          currency: transaction_currency;
          total_balance: number;
          balances_by_account: {
            BALANCE_RESERVE: number;
            BALANCE_AVAILABLE: number;
            BALANCE_PENDING: number;
          };
        }
      >,
    );

    // // Adiciona balance_blocked da company
    // Object.keys(balancesByCurrency).forEach((curr) => {
    //   balancesByCurrency[curr].balance_blocked = company.balance_blocked;
    // });

    return {
      company_id: companyId,
      balances: Object.values(balancesByCurrency),
    };
  }

  async getWalletsByAccountType(
    companyId: string,
    accountType: transaction_account_type,
  ) {
    const wallets = await this.walletService.getWalletsByAccountType(
      companyId,
      accountType,
    );

    return wallets;
  }

  async getStatus(companyId: string) {
    const company = await this.companyRepository.findByIdCompleted(companyId);

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Conta quantas wallets e configs de taxa existem
    const walletsCount = company.wallets?.length || 0;

    return {
      id: company.id,
      name: company.name,
      status: company.status,
      has_documents: !!company.company_document,
      has_tax_config:
        !!company.company_tax_configs && company.company_tax_configs.length > 0,
      has_config: !!company.company_config,
      wallets_count: walletsCount,
      currencies_enabled: [
        ...new Set(company.wallets?.map((w) => w.currency) || []),
      ],
      created_at: company.created_at,
      banned_at: company.banned_at,
    };
  }

  async hasTaxConfigForCurrency(
    companyId: string,
    currency: transaction_currency,
  ): Promise<boolean> {
    return this.companyTaxConfigRepository.existsByCompanyIdAndCurrency(
      companyId,
      currency,
    );
  }

  async getTaxConfigsGroupedByCurrency(companyId: string) {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const grouped =
      await this.companyTaxConfigRepository.findAllByCompanyIdGroupedByCurrency(
        companyId,
      );

    if (Object.keys(grouped).length === 0) {
      throw new NotFoundException('No tax configurations found');
    }

    return grouped;
  }

  // ======== HELPERS ========

  validatePaymentMethodReserveDays = (
    paymentMethod: string,
    taxFee: number | undefined,
    taxRate: number | undefined,
    availableDays: number | undefined,
  ) => {
    // Só valida se pelo menos uma taxa foi definida
    if (taxFee === undefined && taxRate === undefined) {
      return;
    }

    if (
      ((taxFee || 0) > 0 || (taxRate || 0) > 0) &&
      (!availableDays || availableDays < 1)
    ) {
      throw new BadRequestException(
        `available_days_reserve_${paymentMethod} must be at least 1 when tax_fee or tax_rate is set`,
      );
    }
  };
}
