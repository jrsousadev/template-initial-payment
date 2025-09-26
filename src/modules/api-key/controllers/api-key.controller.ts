// api-keys/api-keys.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiHeader,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { CommonAuthErrors } from 'src/common/decorators/common-errors.decorator';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ValidateApiKeyDto,
} from '../dto/api-key.dto';
import {
  ApiKeyResponseDto,
  ApiKeyListItemDto,
  ApiKeyDetailsDto,
  ApiKeyUpdateResponseDto,
  ApiKeyValidationDto,
  ApiKeyRegenerateResponseDto,
} from '../interfaces/api-key.interfaces';
import { ApiKeysService } from '../services/api-key.service';

@ApiTags('API Keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post('companies/:companyId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create API key for company',
    description:
      'Create a new API key pair (public and secret) for a company with specified permissions. Requires user authentication and company access.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company identifier',
    example: 'comp_1234567890',
  })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
    type: ApiKeyResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid company ID or API key data',
      unauthorized: 'Authentication required',
      forbidden: 'No permission to create API keys for this company',
    },
  })
  async create(
    @Param('companyId') companyId: string,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ) {
    // Verifica se o usuário tem permissão para criar chaves desta empresa
    // (TO DO): Implementar verificação de permissão

    return this.apiKeysService.create(companyId, createApiKeyDto);
  }

  @Get('companies/:companyId')
  @ApiOperation({
    summary: 'List company API keys',
    description:
      'Retrieve all API keys for a specific company. Secret keys are masked for security.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company identifier',
    example: 'comp_1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'List of API keys for the company',
    type: [ApiKeyListItemDto],
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid company ID',
      unauthorized: 'Authentication required',
      forbidden: 'No permission to view API keys for this company',
    },
  })
  async findAll(@Param('companyId') companyId: string) {
    return this.apiKeysService.findAll(companyId);
  }

  @Get('companies/:companyId/:apiKeyId')
  @ApiOperation({
    summary: 'Get specific API key details',
    description:
      'Retrieve details of a specific API key. Secret key is masked for security.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company identifier',
    example: 'comp_1234567890',
  })
  @ApiParam({
    name: 'apiKeyId',
    description: 'API key identifier',
    example: 'key_1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'API key details',
    type: ApiKeyDetailsDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid company ID or API key ID',
      unauthorized: 'Authentication required',
      forbidden: 'No permission to view this API key',
    },
  })
  async findOne(
    @Param('companyId') companyId: string,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    return this.apiKeysService.findOne(companyId, apiKeyId);
  }

  @Put('companies/:companyId/:apiKeyId')
  @ApiOperation({
    summary: 'Update API key',
    description:
      'Update API key description and permissions. Cannot modify the key values themselves.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company identifier',
    example: 'comp_1234567890',
  })
  @ApiParam({
    name: 'apiKeyId',
    description: 'API key identifier',
    example: 'key_1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'API key updated successfully',
    type: ApiKeyUpdateResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid company ID, API key ID, or update data',
      unauthorized: 'Authentication required',
      forbidden: 'No permission to update this API key',
    },
  })
  async update(
    @Param('companyId') companyId: string,
    @Param('apiKeyId') apiKeyId: string,
    @Body() updateApiKeyDto: UpdateApiKeyDto,
  ) {
    return this.apiKeysService.update(companyId, apiKeyId, updateApiKeyDto);
  }

  @Delete('companies/:companyId/:apiKeyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete API key',
    description:
      'Permanently delete an API key. This action cannot be undone and will immediately invalidate the key.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company identifier',
    example: 'comp_1234567890',
  })
  @ApiParam({
    name: 'apiKeyId',
    description: 'API key identifier',
    example: 'key_1234567890',
  })
  @ApiResponse({
    status: 204,
    description: 'API key deleted successfully',
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid company ID or API key ID',
      unauthorized: 'Authentication required',
      forbidden: 'No permission to delete this API key',
    },
  })
  async delete(
    @Param('companyId') companyId: string,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    await this.apiKeysService.delete(companyId, apiKeyId);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate API key pair',
    description:
      'Validate if a public and secret key pair is valid and active. Returns key details and permissions.',
  })
  @ApiResponse({
    status: 200,
    description: 'API key validation result',
    type: ApiKeyValidationDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    customMessages: {
      badRequest: 'Invalid API key format or missing keys',
    },
  })
  async validate(@Body() validateApiKeyDto: ValidateApiKeyDto) {
    return this.apiKeysService.validate(validateApiKeyDto);
  }

  @Post('companies/:companyId/:apiKeyId/regenerate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Regenerate API key pair',
    description:
      'Generate new public and secret keys for an existing API key. The old keys will be immediately invalidated.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company identifier',
    example: 'comp_1234567890',
  })
  @ApiParam({
    name: 'apiKeyId',
    description: 'API key identifier',
    example: 'key_1234567890',
  })
  @ApiResponse({
    status: 201,
    description: 'API key regenerated successfully',
    type: ApiKeyRegenerateResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid company ID or API key ID',
      unauthorized: 'Authentication required',
      forbidden: 'No permission to regenerate this API key',
    },
  })
  async regenerate(
    @Param('companyId') companyId: string,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    return this.apiKeysService.regenerate(companyId, apiKeyId);
  }

  @Post('validate-headers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate API keys from headers',
    description:
      'Validate API keys provided in request headers (x-api-key-public and x-api-key-secret).',
  })
  @ApiHeader({
    name: 'x-api-key-public',
    description: 'Public API key',
    required: true,
    example: 'pk_live_1234567890abcdef',
  })
  @ApiHeader({
    name: 'x-api-key-secret',
    description: 'Secret API key',
    required: true,
    example: 'sk_live_abcdef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'API key validation result from headers',
    type: ApiKeyValidationDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    customMessages: {
      badRequest: 'Missing or invalid API keys in headers',
    },
  })
  async validateHeaders(
    @Headers('x-api-key-public') publicKey: string,
    @Headers('x-api-key-secret') secretKey: string,
  ) {
    if (!publicKey || !secretKey) {
      throw new BadRequestException('API keys are required in headers');
    }

    return this.apiKeysService.validate({
      public_key: publicKey,
      secret_key: secretKey,
    });
  }
}
