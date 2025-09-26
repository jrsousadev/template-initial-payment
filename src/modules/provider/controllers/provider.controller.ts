// provider.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  CreateProviderDto,
  UpdateProviderDto,
  CreateProviderTaxConfigDto,
  UpdateProviderTaxConfigDto,
  CreateSubAccountDto,
  AssignProviderToCompanyDto,
} from '../dto/provider.dto';
import { ProviderService } from '../services/provider.service';
import { CommonAuthErrors } from 'src/common/decorators/common-errors.decorator';
import {
  ProviderResponseDto,
  ProviderDetailsDto,
  ProviderUpdateResponseDto,
  MessageResponseDto,
} from '../interfaces/provider.interfaces';

// (TO DO) Autenticação admin
@ApiTags('Providers')
@Controller('providers')
export class ProviderController {
  constructor(private readonly providerService: ProviderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new provider',
    description:
      'Create a new payment provider with configuration details. This endpoint is restricted to admin users.',
  })
  @ApiBody({ type: CreateProviderDto })
  @ApiResponse({
    status: 201,
    description: 'Provider created successfully',
    type: ProviderResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid provider data or validation errors',
      unauthorized: 'Admin authentication required',
      forbidden: 'Insufficient admin permissions',
    },
  })
  async create(@Body() createProviderDto: CreateProviderDto) {
    return this.providerService.create(createProviderDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all providers',
    description:
      'Retrieve a list of all payment providers in the system. Admin access required.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of providers',
    type: [ProviderResponseDto],
  })
  @CommonAuthErrors({
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      unauthorized: 'Admin authentication required',
      forbidden: 'Insufficient admin permissions',
    },
  })
  async findAll() {
    return this.providerService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get provider by ID',
    description:
      'Retrieve detailed information about a specific provider by its ID.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Provider ID',
    example: 'prv_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider details',
    type: ProviderDetailsDto,
  })
  @CommonAuthErrors({
    includeUnauthorized: true,
    includeForbidden: true,
    includeNotFound: true,
    customMessages: {
      unauthorized: 'Admin authentication required',
      forbidden: 'Insufficient admin permissions',
      notFound: 'Provider not found',
    },
  })
  async findOne(@Param('id') id: string) {
    return this.providerService.findById(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update provider',
    description:
      'Update provider configuration and settings. Admin access required.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Provider ID',
    example: 'prv_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiBody({ type: UpdateProviderDto })
  @ApiResponse({
    status: 200,
    description: 'Provider updated successfully',
    type: ProviderUpdateResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    includeNotFound: true,
    customMessages: {
      badRequest: 'Invalid provider data or validation errors',
      unauthorized: 'Admin authentication required',
      forbidden: 'Insufficient admin permissions',
      notFound: 'Provider not found',
    },
  })
  async update(
    @Param('id') id: string,
    @Body() updateProviderDto: UpdateProviderDto,
  ) {
    return this.providerService.update(id, updateProviderDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete provider',
    description:
      'Permanently delete a provider. This action cannot be undone and will affect all associated configurations.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Provider ID',
    example: 'prv_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 204,
    description: 'Provider deleted successfully',
  })
  @CommonAuthErrors({
    includeUnauthorized: true,
    includeForbidden: true,
    includeNotFound: true,
    customMessages: {
      unauthorized: 'Admin authentication required',
      forbidden: 'Insufficient admin permissions',
      notFound: 'Provider not found',
    },
  })
  async delete(@Param('id') id: string) {
    await this.providerService.delete(id);
  }

  // ========== TAX CONFIG ENDPOINTS ==========

  @Get(':id/tax-config')
  async getTaxConfig(@Param('id') id: string) {
    const taxConfig = await this.providerService.getTaxConfig(id);

    return {
      tax_config: taxConfig,
    };
  }

  @Post(':id/tax-config')
  @HttpCode(HttpStatus.CREATED)
  async createTaxConfig(
    @Param('id') id: string,
    @Body() createTaxConfigDto: CreateProviderTaxConfigDto,
  ) {
    const created = await this.providerService.createTaxConfig(
      id,
      createTaxConfigDto,
    );

    return {
      message: 'Provider tax configuration created successfully',
      tax_config: created,
    };
  }

  @Put(':id/tax-config')
  async updateTaxConfig(
    @Param('id') id: string,
    @Body() updateTaxConfigDto: UpdateProviderTaxConfigDto,
  ) {
    const updated = await this.providerService.updateTaxConfig(
      id,
      updateTaxConfigDto,
    );

    return {
      message: 'Provider tax configuration updated successfully',
      tax_config: updated,
    };
  }

  // ========== SUB-ACCOUNT ENDPOINTS ==========

  @Post(':providerId/companies/:companyId/sub-accounts')
  @HttpCode(HttpStatus.CREATED)
  async createSubAccount(
    @Param('providerId') providerId: string,
    @Param('companyId') companyId: string,
    @Body() createSubAccountDto: CreateSubAccountDto,
  ) {
    return this.providerService.createSubAccount(
      providerId,
      companyId,
      createSubAccountDto,
    );
  }

  @Get(':providerId/companies/:companyId/sub-accounts')
  async getSubAccount(
    @Param('providerId') providerId: string,
    @Param('companyId') companyId: string,
  ) {
    return this.providerService.getSubAccount(providerId, companyId);
  }

  // ========== COMPANY ASSIGNMENT ENDPOINTS ==========

  @Post('companies/:companyId/assign')
  @HttpCode(HttpStatus.OK)
  async assignProviderToCompany(
    @Param('companyId') companyId: string,
    @Body() assignDto: AssignProviderToCompanyDto,
  ) {
    return this.providerService.assignProviderToCompany(companyId, assignDto);
  }

  @Get('companies/:companyId')
  async getProvidersByCompany(@Param('companyId') companyId: string) {
    return this.providerService.getProvidersByCompany(companyId);
  }
}
