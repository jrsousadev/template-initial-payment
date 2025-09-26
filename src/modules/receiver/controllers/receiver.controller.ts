import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ReceiverService } from '../services/receiver.service';
import {
  CreateReceiverDto,
  UpdateReceiverStatusDto,
} from '../dto/receiver.dto';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { CompanyApiKey } from 'src/modules/payment/interfaces/transaction.interfaces';
import { ApiKeyHeaders } from 'src/common/decorators/api-key-headers.decorator';
import { CommonAuthErrors } from 'src/common/decorators/common-errors.decorator';
import {
  ReceiverResponseDto,
  ReceiverDetailsDto,
  ReceiverListResponseDto,
  ReceiverStatusUpdateResponseDto,
  MessageResponseDto,
} from '../interfaces/receiver.interfaces';

@ApiTags('Receivers')
@Controller('receivers')
@UseGuards(ApiKeyGuard)
@ApiKeyHeaders()
export class ReceiverController {
  constructor(private readonly receiverService: ReceiverService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new receiver',
    description:
      'Create a new receiver for the authenticated company. Receivers are entities that can receive payments and withdrawals.',
  })
  @ApiResponse({
    status: 201,
    description: 'Receiver created successfully',
    type: ReceiverResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid receiver data or validation errors',
      forbidden: 'Insufficient permissions to create receivers',
    },
  })
  async create(
    @Body() dto: CreateReceiverDto,
    @Req() { company }: { company: CompanyApiKey },
  ) {
    return await this.receiverService.create(dto, company.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List all receivers',
    description:
      'Retrieve a paginated list of all receivers for the authenticated company with optional status filtering.',
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
    enum: ['ACTIVE', 'PENDING', 'REJECTED'],
    description: 'Filter receivers by status',
    example: 'ACTIVE',
  })
  @ApiResponse({
    status: 200,
    description: 'List of receivers with pagination',
    type: ReceiverListResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid query parameters',
      forbidden: 'Insufficient permissions to read receivers',
    },
  })
  async findAll(
    @Req() { company }: { company: CompanyApiKey },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pageNumber = page ? parseInt(page) : 1;
    const limitNumber = limit ? parseInt(limit) : 20;

    return await this.receiverService.findAll(
      company.id,
      pageNumber,
      limitNumber,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a receiver by ID',
    description:
      'Retrieve detailed information about a specific receiver by its ID.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Receiver ID',
    example: 'rcv_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 200,
    description: 'Receiver details',
    type: ReceiverDetailsDto,
  })
  @CommonAuthErrors({
    includeForbidden: true,
    includeNotFound: true,
    customMessages: {
      forbidden: 'Insufficient permissions to read receivers',
      notFound: 'Receiver not found',
    },
  })
  async findOne(
    @Param('id') id: string,
    @Req() { company }: { company: CompanyApiKey },
  ) {
    return await this.receiverService.findOne(id, company.id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update receiver status',
    description:
      'Update the status of a receiver (e.g., activate, reject, or set to pending).',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Receiver ID',
    example: 'rcv_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 200,
    description: 'Receiver status updated successfully',
    type: ReceiverStatusUpdateResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeForbidden: true,
    includeNotFound: true,
    customMessages: {
      badRequest: 'Invalid status or receiver data',
      forbidden: 'Insufficient permissions to update receivers',
      notFound: 'Receiver not found',
    },
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReceiverStatusDto,
    @Req() { company }: { company: CompanyApiKey },
  ) {
    return await this.receiverService.updateStatus(id, company.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a receiver',
    description:
      'Permanently delete a receiver. This action cannot be undone and will remove all receiver data.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Receiver ID',
    example: 'rcv_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 204,
    description: 'Receiver deleted successfully',
  })
  @CommonAuthErrors({
    includeForbidden: true,
    includeNotFound: true,
    customMessages: {
      forbidden: 'Insufficient permissions to delete receivers',
      notFound: 'Receiver not found',
    },
  })
  async delete(
    @Param('id') id: string,
    @Req() { company }: { company: CompanyApiKey },
  ) {
    await this.receiverService.delete(id, company.id);
  }
}
