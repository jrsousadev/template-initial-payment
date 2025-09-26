import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { transaction_currency } from '@prisma/client';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { CompanyApiKey } from 'src/modules/payment/interfaces/transaction.interfaces';
import { ApiKeyHeaders } from 'src/common/decorators/api-key-headers.decorator';
import { CommonAuthErrors } from 'src/common/decorators/common-errors.decorator';
import {
  CreateAnticipationDto,
  ListAnticipationsQueryDto,
  SimulateAnticipationDto,
} from '../dto/anticipation.dto';
import {
  AvailableSchedulesDto,
  AnticipationSimulationDto,
  AnticipationResponseDto,
  AnticipationListResponseDto,
} from '../interfaces/anticipation.interfaces';
import { AnticipationService } from '../services/anticipation.service';

@ApiTags('Anticipations')
@Controller('anticipations')
@UseGuards(ApiKeyGuard)
@ApiKeyHeaders()
export class AnticipationController {
  constructor(private readonly anticipationService: AnticipationService) {}

  @Get('available')
  @ApiOperation({
    summary: 'Get available schedules for anticipation',
    description:
      'Retrieve all available payment schedules that can be anticipated, grouped by type (installments or pending to available)',
  })
  @ApiQuery({
    name: 'currency',
    enum: ['BRL', 'USD', 'EUR'],
    description: 'Currency filter for available schedules',
    required: true,
    example: 'BRL',
  })
  @ApiResponse({
    status: 200,
    description: 'Available schedules grouped by type',
    type: AvailableSchedulesDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    customMessages: {
      badRequest: 'Invalid currency parameter',
      unauthorized: 'Invalid API key',
    },
  })
  async getAvailable(
    @Req() { company }: { company: CompanyApiKey },
    @Query('currency') currency: transaction_currency,
  ) {
    return await this.anticipationService.getAvailable(company.id, currency);
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulate an anticipation',
    description:
      'Calculate the costs and net amount for anticipating payment schedules before creating the actual anticipation',
  })
  @ApiResponse({
    status: 200,
    description:
      'Anticipation simulation result with calculated fees and net amounts',
    type: AnticipationSimulationDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    customMessages: {
      badRequest:
        'Invalid simulation parameters or no schedules available for anticipation',
      unauthorized: 'Invalid API key',
    },
  })
  async simulate(
    @Body() dto: SimulateAnticipationDto,
    @Req() { company }: { company: CompanyApiKey },
  ) {
    return await this.anticipationService.simulate(company.id, dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new anticipation',
    description:
      'Create an anticipation request for available payment schedules. This will process the anticipation and transfer funds to the available balance.',
  })
  @ApiResponse({
    status: 201,
    description: 'Anticipation created successfully',
    type: AnticipationResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    customMessages: {
      badRequest:
        'Invalid anticipation data, insufficient balance, or no schedules available for anticipation',
      unauthorized: 'Invalid API key',
    },
  })
  async create(
    @Body() dto: CreateAnticipationDto,
    @Req() { company }: { company: CompanyApiKey },
  ) {
    return await this.anticipationService.create(company.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List company anticipations',
    description:
      'Retrieve a paginated list of all anticipations for the authenticated company with optional filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'List of anticipations with pagination metadata',
    type: AnticipationListResponseDto,
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
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED'],
    description: 'Filter by anticipation status',
    example: 'APPROVED',
  })
  @ApiQuery({
    name: 'from_date',
    required: false,
    type: String,
    description: 'Filter anticipations created from this date (YYYY-MM-DD)',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'to_date',
    required: false,
    type: String,
    description: 'Filter anticipations created until this date (YYYY-MM-DD)',
    example: '2025-12-31',
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeUnauthorized: true,
    customMessages: {
      badRequest: 'Invalid query parameters or date format',
      unauthorized: 'Invalid API key',
    },
  })
  async list(
    @Req() { company }: { company: CompanyApiKey },
    @Query() query: ListAnticipationsQueryDto,
  ) {
    return await this.anticipationService.list(company.id, query);
  }
}
