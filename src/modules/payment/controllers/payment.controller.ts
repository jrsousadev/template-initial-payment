import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyHeaders } from 'src/common/decorators/api-key-headers.decorator';
import { CommonAuthErrors } from 'src/common/decorators/common-errors.decorator';
import { Idempotent } from 'src/common/decorators/idempotency-request.decorator';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { RequestMetadata } from 'src/common/decorators/request-metadata.decorator';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { Permission } from 'src/common/permissions/permissions.enum';
import { CreatePaymentRequestDto } from '../dto/payment.dto';
import { Payment } from '../entities/payment.entity';
import {
  CompanyApiKey,
  IPaymentResponse,
  PaymentResponseDto,
  PaymentListResponseDto,
  MessageResponseDto,
} from '../interfaces/transaction.interfaces';
import { PaymentService } from '../services/payment.service';

@ApiTags('Payments')
@Controller('payments')
@UseInterceptors(ClassSerializerInterceptor)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @RequirePermissions(Permission.WRITE_PAYMENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new payment',
    description:
      'Create a new payment transaction with customer information, items, and payment method details. Supports PIX, credit card, and billet payments.',
  })
  @ApiBody({ type: CreatePaymentRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    type: PaymentResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeForbidden: true,
    includeConflict: true,
    customMessages: {
      badRequest: 'Invalid payment data or validation errors',
      conflict: 'Payment with external_id already exists',
      forbidden: 'Insufficient permissions to create payments',
    },
  })
  @Idempotent({ ttl: 86400 })
  @UseGuards(ApiKeyGuard)
  @ApiKeyHeaders()
  async create(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: CreatePaymentRequestDto,
    @RequestMetadata() { ipAddress }: RequestMetadata,
    @Req() { company, apiKeyId }: { company: CompanyApiKey; apiKeyId: string },
  ): Promise<IPaymentResponse> {
    return await this.paymentService.create(dto, ipAddress, company, apiKeyId);
  }

  @Get()
  @RequirePermissions(Permission.READ_PAYMENT)
  @ApiOperation({
    summary: 'List all payments',
    description:
      'Retrieve a paginated list of all payments for the authenticated company. Supports pagination with page and limit parameters.',
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
    description: 'List of payments with pagination',
    type: PaymentListResponseDto,
  })
  @CommonAuthErrors({
    includeForbidden: true,
    customMessages: {
      forbidden: 'Insufficient permissions to read payments',
    },
  })
  @UseGuards(ApiKeyGuard)
  @ApiKeyHeaders()
  async findAll(
    @Req() { company }: { company: CompanyApiKey },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? parseInt(page) : 1;
    const limitNumber = limit ? parseInt(limit) : 20;

    return await this.paymentService.findAll(
      pageNumber,
      limitNumber,
      company.id,
    );
  }

  @Post(':id/refund')
  @RequirePermissions(Permission.REFUND_PAYMENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refund a payment',
    description:
      'Process a full refund for an approved payment. The payment must be in APPROVED status and within the refund window.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Payment ID to refund',
    example: 'pay_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment refunded successfully',
    type: PaymentResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Payment cannot be refunded (invalid status or expired)',
      forbidden: 'Insufficient permissions to refund payments',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Payment not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @UseGuards(ApiKeyGuard)
  @ApiKeyHeaders()
  async refund(
    @Param('id') id: string,
    @RequestMetadata() { ipAddress }: RequestMetadata,
    @Req() { company }: { company: CompanyApiKey },
  ): Promise<IPaymentResponse> {
    return await this.paymentService.refund({
      companyId: company.id,
      paymentId: id,
      ipAddress,
    });
  }

  @Get('search/:value')
  @RequirePermissions(Permission.READ_PAYMENT)
  @ApiOperation({
    summary: 'Find payment by different search criteria',
    description:
      'Search for a specific payment using different identifiers: payment ID, external ID, or end-to-end ID. Useful for payment reconciliation and lookup.',
  })
  @ApiParam({
    name: 'value',
    type: 'string',
    description: 'Value to search (ID, External ID, or End-to-End ID)',
    example: 'pay_cm3x7n8f70000vs6g5jkg5hkn',
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
    description: 'Payment found successfully',
    type: PaymentResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid search criteria or search value format',
      forbidden: 'Insufficient permissions to read payments',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found with the provided criteria',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Payment not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @UseGuards(ApiKeyGuard)
  @ApiKeyHeaders()
  async findUnique(
    @Param('value') value: string,
    @Req() { company }: { company: CompanyApiKey },
    @Query('searchBy') searchBy?: string,
  ): Promise<IPaymentResponse> {
    const validSearchTypes = ['id', 'external_id', 'end_to_end'];
    const searchType = searchBy || 'id';

    if (!validSearchTypes.includes(searchType)) {
      throw new BadRequestException(
        `Invalid searchBy parameter. Must be one of: ${validSearchTypes.join(', ')}`,
      );
    }

    return await this.paymentService.findUnique(value, searchType, company.id);
  }
}
