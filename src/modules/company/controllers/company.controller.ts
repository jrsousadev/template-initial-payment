// company.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  BadRequestException,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiSecurity,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { CompanyService } from '../services/company.service';
import {
  CreateCompanyDto,
  UploadCompanyDocumentsDto,
  UpdateCompanyTaxConfigDto,
  UpdateCompanyConfigDto,
} from '../dto/company.dto';
import { transaction_account_type, transaction_currency } from '@prisma/client';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { CompanyApiKey } from 'src/modules/payment/interfaces/transaction.interfaces';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Permission } from 'src/common/permissions/permissions.enum';
import { CommonAuthErrors } from 'src/common/decorators/common-errors.decorator';
import {
  CompanyResponseDto,
  DocumentUploadResponseDto,
  TaxConfigResponseDto,
  TaxConfigsResponseDto,
  TaxConfigUpdateResponseDto,
  TaxConfigCreateResponseDto,
  CompanyConfigResponseDto,
  CompanyConfigUpdateResponseDto,
  CompanyConfigCreateResponseDto,
  CompanyStatusResponseDto,
  CompanyBalancesResponseDto,
  WalletsResponseDto,
} from '../interfaces/company.interfaces';

interface FastifyRequestWithMultipart extends FastifyRequest {
  isMultipart(): boolean;
  parts(): AsyncIterableIterator<any>;
  company?: CompanyApiKey;
}

@ApiTags('Companies')
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new company',
    description:
      'Register a new company in the system with basic information and address details.',
  })
  @ApiResponse({
    status: 201,
    description: 'Company created successfully',
    type: CompanyResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeConflict: true,
    customMessages: {
      badRequest: 'Invalid company data or validation errors',
      conflict: 'Company with this CNPJ already exists',
    },
  })
  async create(@Body() createCompanyDto: CreateCompanyDto) {
    const company = await this.companyService.create(createCompanyDto);

    return {
      id: company.id,
      name: company.name,
      email: company.email,
      document: company.document,
      status: company.status,
      created_at: company.created_at,
    };
  }

  @Post('/documents')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload company documents',
    description:
      'Upload required company documents for KYC compliance including social contract, CNPJ card, and responsible person documents.',
  })
  @ApiBody({
    description: 'Company documents and information',
    schema: {
      type: 'object',
      properties: {
        // Document files
        contract_social: {
          type: 'string',
          format: 'binary',
          description: 'Company social contract document (PDF, JPG, PNG)',
        },
        card_cnpj: {
          type: 'string',
          format: 'binary',
          description: 'CNPJ registration card (PDF, JPG, PNG)',
        },
        document_front_responsible: {
          type: 'string',
          format: 'binary',
          description: 'Front side of responsible person ID (JPG, PNG, PDF)',
        },
        document_back_responsible: {
          type: 'string',
          format: 'binary',
          description: 'Back side of responsible person ID (JPG, PNG, PDF)',
        },
        document_selfie_responsible: {
          type: 'string',
          format: 'binary',
          description: 'Selfie photo of responsible person with ID (JPG, PNG)',
        },
        // Form fields
        mother_name_responsible: {
          type: 'string',
          description: 'Mother name of responsible person',
          example: 'Maria Silva Santos',
        },
        phone_responsible: {
          type: 'string',
          description: 'Phone number of responsible person',
          example: '+5511999999999',
        },
        document_responsible: {
          type: 'string',
          description: 'CPF of responsible person (11 digits)',
          example: '12345678901',
        },
        name_responsible: {
          type: 'string',
          description: 'Full name of responsible person',
          example: 'João Silva Santos',
        },
        cnae_company: {
          type: 'string',
          description: 'Company CNAE code',
          example: '6201-5/00',
        },
        phone_company: {
          type: 'string',
          description: 'Company phone number',
          example: '+5511888888888',
        },
        website_company: {
          type: 'string',
          description: 'Company website (optional)',
          example: 'https://www.company.com',
        },
        created_company_date: {
          type: 'string',
          format: 'date',
          description: 'Company creation date (YYYY-MM-DD)',
          example: '2020-01-15',
        },
        average_ticket: {
          type: 'number',
          description: 'Average transaction value (optional)',
          example: 150.5,
        },
        monthly_revenue: {
          type: 'number',
          description: 'Monthly revenue estimate (optional)',
          example: 50000.0,
        },
      },
      required: [
        'contract_social',
        'card_cnpj',
        'document_front_responsible',
        'document_back_responsible',
        'document_selfie_responsible',
        'mother_name_responsible',
        'phone_responsible',
        'document_responsible',
        'name_responsible',
        'cnae_company',
        'phone_company',
        'created_company_date',
      ],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Documents uploaded successfully',
    type: DocumentUploadResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includePayloadTooLarge: true,
    customMessages: {
      badRequest: 'Missing required documents or invalid file format',
      unauthorized: 'Invalid API key',
      payloadTooLarge: 'File size exceeds limit (max 5MB per file)',
    },
  })
  async uploadDocuments(@Req() request: FastifyRequestWithMultipart) {
    if (!request.isMultipart()) {
      throw new BadRequestException('Request must be multipart');
    }

    const parts = request.parts();
    const files: Record<string, any> = {};
    const fields: Record<string, any> = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        files[part.fieldname] = {
          filename: part.filename,
          mimetype: part.mimetype,
          buffer: buffer,
          size: buffer.length,
        };
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    // Validação dos arquivos obrigatórios
    const requiredFiles = [
      'contract_social',
      'card_cnpj',
      'document_front_responsible',
      'document_back_responsible',
      'document_selfie_responsible',
    ];

    for (const file of requiredFiles) {
      if (!files[file]) {
        throw new BadRequestException(`${file} is required`);
      }
    }

    // Converte tipos numéricos
    const documentsDto: UploadCompanyDocumentsDto = {
      mother_name_responsible: fields.mother_name_responsible,
      phone_responsible: fields.phone_responsible,
      document_responsible: fields.document_responsible,
      name_responsible: fields.name_responsible,
      cnae_company: fields.cnae_company,
      phone_company: fields.phone_company,
      website_company: fields.website_company || undefined,
      created_company_date: fields.created_company_date,
      average_ticket: fields.average_ticket
        ? parseFloat(fields.average_ticket)
        : undefined,
      monthly_revenue: fields.monthly_revenue
        ? parseFloat(fields.monthly_revenue)
        : undefined,
    };

    const document = await this.companyService.uploadDocuments(
      request.company!.id,
      documentsDto,
      files,
    );

    return {
      message: 'Documents uploaded successfully',
      document: {
        id: document.id,
        created_at: document.created_at,
      },
      company_status: 'ACTIVE',
    };
  }

  // ========== TAX CONFIG ENDPOINTS ==========

  @Get('/tax-config')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get company tax configuration',
    description:
      'Retrieve tax configuration for a specific currency or all currencies if no currency is specified.',
  })
  @ApiQuery({
    name: 'currency',
    enum: ['BRL', 'USD', 'EUR'],
    required: false,
    description: 'Currency filter for tax configuration',
    example: 'BRL',
  })
  @ApiResponse({
    status: 200,
    description: 'Tax configuration retrieved successfully',
    schema: {
      oneOf: [
        { $ref: '#/components/schemas/TaxConfigResponseDto' },
        { $ref: '#/components/schemas/TaxConfigsResponseDto' },
      ],
    },
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    customMessages: {
      badRequest: 'Invalid currency parameter',
      unauthorized: 'Invalid API key',
    },
  })
  async getTaxConfig(
    @Req() { company }: { company: CompanyApiKey },
    @Query('currency') currency?: transaction_currency,
  ) {
    if (currency) {
      const taxConfig = await this.companyService.getTaxConfig(
        company.id,
        currency,
      );

      return { tax_config: taxConfig };
    }

    const taxConfigs = await this.companyService.getAllTaxConfigs(company.id);
    return { tax_configs: taxConfigs };
  }

  @Put('/tax-config')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Update company tax configuration',
    description:
      'Update existing tax configuration for a specific currency with new rates, fees, and settings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tax configuration updated successfully',
    type: TaxConfigUpdateResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    customMessages: {
      badRequest: 'Invalid tax configuration data or currency not found',
      unauthorized: 'Invalid API key',
    },
  })
  async updateTaxConfig(
    @Req() { company }: { company: CompanyApiKey },
    @Body() updateTaxConfigDto: UpdateCompanyTaxConfigDto,
  ) {
    const updated = await this.companyService.updateTaxConfig(
      company.id,
      updateTaxConfigDto,
    );

    return {
      message: 'Tax configuration updated successfully',
      tax_config: updated,
    };
  }

  @Post('/tax-config')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Create company tax configuration',
    description:
      'Create a new tax configuration for a specific currency with rates, fees, and payment settings.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tax configuration created successfully',
    type: TaxConfigCreateResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeConflict: true,
    customMessages: {
      badRequest: 'Invalid tax configuration data',
      unauthorized: 'Invalid API key',
      conflict: 'Tax configuration for this currency already exists',
    },
  })
  async createTaxConfig(
    @Req() { company }: { company: CompanyApiKey },
    @Body() createTaxConfigDto: UpdateCompanyTaxConfigDto,
  ) {
    const created = await this.companyService.createTaxConfig(
      company.id,
      createTaxConfigDto,
    );

    return {
      message: 'Tax configuration created successfully',
      tax_config: created,
    };
  }

  // ========== COMPANY CONFIG ENDPOINTS ==========

  @Get('/config')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get company configuration',
    description:
      'Retrieve current company configuration settings including payment methods and feature flags.',
  })
  @ApiResponse({
    status: 200,
    description: 'Company configuration retrieved successfully',
    type: CompanyConfigResponseDto,
  })
  @CommonAuthErrors({
    includeUnauthorized: true,
    customMessages: {
      unauthorized: 'Invalid API key',
    },
  })
  async getConfig(@Req() { company }: { company: CompanyApiKey }) {
    const config = await this.companyService.getConfig(company.id);

    return { config };
  }

  @Put('/config')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Update company configuration',
    description:
      'Update company configuration settings for payment methods and features.',
  })
  @ApiResponse({
    status: 200,
    description: 'Company configuration updated successfully',
    type: CompanyConfigUpdateResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    customMessages: {
      badRequest: 'Invalid configuration data',
      unauthorized: 'Invalid API key',
    },
  })
  async updateConfig(
    @Req() { company }: { company: CompanyApiKey },
    @Body() updateConfigDto: UpdateCompanyConfigDto,
  ) {
    const updated = await this.companyService.updateConfig(
      company.id,
      updateConfigDto,
    );

    return {
      message: 'Company configuration updated successfully',
      config: updated,
    };
  }

  @Post('/config')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Create company configuration',
    description:
      'Create initial company configuration with payment methods and feature settings.',
  })
  @ApiResponse({
    status: 201,
    description: 'Company configuration created successfully',
    type: CompanyConfigCreateResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeConflict: true,
    customMessages: {
      badRequest: 'Invalid configuration data',
      unauthorized: 'Invalid API key',
      conflict: 'Company configuration already exists',
    },
  })
  async createConfig(
    @Req() { company }: { company: CompanyApiKey },
    @Body() createConfigDto: UpdateCompanyConfigDto,
  ) {
    const created = await this.companyService.createConfig(
      company.id,
      createConfigDto,
    );

    return {
      message: 'Company configuration created successfully',
      config: created,
    };
  }

  // ========== OTHER ENDPOINTS ==========

  @Get('/status')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get company status',
    description:
      'Retrieve current company status and verification information.',
  })
  @ApiResponse({
    status: 200,
    description: 'Company status retrieved successfully',
    type: CompanyStatusResponseDto,
  })
  @CommonAuthErrors({
    includeUnauthorized: true,
    customMessages: {
      unauthorized: 'Invalid API key',
    },
  })
  async getStatus(@Req() { company }: { company: CompanyApiKey }) {
    const status = await this.companyService.getStatus(company.id);

    return { status };
  }

  @Get('/balances')
  @RequirePermissions(Permission.READ_BALANCE)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get company balances',
    description:
      'Retrieve company wallet balances for all account types or a specific currency.',
  })
  @ApiQuery({
    name: 'currency',
    enum: ['BRL', 'USD', 'EUR'],
    required: false,
    description: 'Currency filter for balances',
    example: 'BRL',
  })
  @ApiResponse({
    status: 200,
    description: 'Company balances retrieved successfully',
    type: CompanyBalancesResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid currency parameter',
      unauthorized: 'Invalid API key',
      forbidden: 'No permission to read balances',
    },
  })
  async getBalances(
    @Req() { company }: { company: CompanyApiKey },
    @Query('currency') currency?: transaction_currency,
  ) {
    const balances = await this.companyService.getBalances(
      company.id,
      currency,
    );
    return balances;
  }

  @Get('/wallets/:accountType')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get wallets by account type',
    description:
      'Retrieve company wallets filtered by account type (AVAILABLE, PENDING, RESERVED).',
  })
  @ApiParam({
    name: 'accountType',
    enum: ['AVAILABLE', 'PENDING', 'RESERVED'],
    description: 'Account type to filter wallets',
    example: 'AVAILABLE',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallets retrieved successfully',
    type: WalletsResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    customMessages: {
      badRequest: 'Invalid account type parameter',
      unauthorized: 'Invalid API key',
    },
  })
  async getWalletsByAccountType(
    @Req() { company }: { company: CompanyApiKey },
    @Param('accountType') accountType: transaction_account_type,
  ) {
    const wallets = await this.companyService.getWalletsByAccountType(
      company.id,
      accountType,
    );

    return { wallets };
  }
}
