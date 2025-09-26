import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WithdrawalService } from '../services/withdrawal.service';
import { CreateWithdrawalDto } from '../dto/withdrawal.dto';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { CompanyApiKey } from 'src/modules/payment/interfaces/transaction.interfaces';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Permission } from 'src/common/permissions/permissions.enum';
import { RequestMetadata } from 'src/common/decorators/request-metadata.decorator';
import { ApiKeyHeaders } from 'src/common/decorators/api-key-headers.decorator';
import { CommonAuthErrors } from 'src/common/decorators/common-errors.decorator';
import {
  WithdrawalCreatedResponseDto,
  WithdrawalListResponseDto,
  WithdrawalDetailsDto,
} from '../interfaces/withdrawal.interfaces';

@ApiTags('Withdrawals')
@Controller('withdrawals')
@UseGuards(ApiKeyGuard)
@ApiKeyHeaders()
export class WithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Post()
  @RequirePermissions(Permission.WRITE_WITHDRAWAL)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new withdrawal',
    description:
      'Create a new withdrawal request for the authenticated company. Requires appropriate permissions and valid receiver information.',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal created successfully',
    type: WithdrawalCreatedResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid withdrawal data or validation errors',
      unauthorized: 'Invalid or missing API key',
      forbidden: 'Insufficient permissions to create withdrawals',
    },
  })
  async create(
    @Body() dto: CreateWithdrawalDto,
    @RequestMetadata() { ipAddress, referer, userAgent }: RequestMetadata,
    @Req() { company, apiKeyId }: { company: CompanyApiKey; apiKeyId: string },
  ) {
    return await this.withdrawalService.create(
      dto,
      ipAddress,
      referer,
      userAgent,
      company,
      apiKeyId,
    );
  }

  @Get()
  @RequirePermissions(Permission.READ_WITHDRAWAL)
  @ApiOperation({
    summary: 'List all withdrawals',
    description:
      'Retrieve a paginated list of all withdrawals for the authenticated company with optional filtering.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'List of withdrawals with pagination',
    type: WithdrawalListResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid query parameters',
      unauthorized: 'Invalid or missing API key',
      forbidden: 'Insufficient permissions to read withdrawals',
    },
  })
  async findAll(
    @Req() { company }: { company: CompanyApiKey },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? parseInt(page) : 1;
    const limitNumber = limit ? parseInt(limit) : 20;

    return await this.withdrawalService.findAll(
      pageNumber,
      limitNumber,
      company.id,
    );
  }

  @Get('search/:value')
  @RequirePermissions(Permission.READ_WITHDRAWAL)
  @ApiOperation({
    summary: 'Find withdrawal by different search criteria',
    description:
      'Search for a specific withdrawal using different identifiers like ID, external ID, or end-to-end ID.',
  })
  @ApiParam({
    name: 'value',
    type: 'string',
    description: 'Value to search (ID, External ID, or End-to-End ID)',
    example: 'wth_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiQuery({
    name: 'searchBy',
    required: false,
    enum: ['id', 'external_id', 'end_to_end'],
    description: 'Search criteria (default: id)',
    example: 'id',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal details',
    type: WithdrawalDetailsDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    includeForbidden: true,
    includeNotFound: true,
    customMessages: {
      badRequest: 'Invalid search parameters or criteria',
      unauthorized: 'Invalid or missing API key',
      forbidden: 'Insufficient permissions to read withdrawals',
      notFound: 'Withdrawal not found',
    },
  })
  async findUnique(
    @Param('value') value: string,
    @Req() { company }: { company: CompanyApiKey },
    @Query('searchBy') searchBy?: string,
  ) {
    const validSearchTypes = ['id', 'external_id', 'end_to_end'];
    const searchType = searchBy || 'id';

    if (!validSearchTypes.includes(searchType)) {
      throw new BadRequestException(
        `Invalid searchBy parameter. Must be one of: ${validSearchTypes.join(', ')}`,
      );
    }

    return await this.withdrawalService.findUnique(
      value,
      searchType,
      company.id,
    );
  }
}
