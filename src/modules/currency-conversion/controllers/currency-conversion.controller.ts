import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { CurrencyConversionService } from '../services/currency-conversion.service';

@ApiTags('Currency Conversions')
@Controller('currency-conversions')
@UseGuards(ApiKeyGuard)
export class CurrencyConversionController {
  constructor(
    private readonly currencyConversionService: CurrencyConversionService,
  ) {}

  // @Post()
  // @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({ summary: 'Create a new currency conversion' })
  // @ApiResponse({
  //   status: 201,
  //   description: 'Currency conversion created successfully',
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       message: { type: 'string' },
  //       conversion: {
  //         type: 'object',
  //         properties: {
  //           id: { type: 'string' },
  //           status: { type: 'string' },
  //           original_amount: { type: 'number' },
  //           original_currency: { type: 'string' },
  //           converted_amount: { type: 'number' },
  //           converted_currency: { type: 'string' },
  //           amount_fee: { type: 'number' },
  //           amount_provider: { type: 'number' },
  //           amount_organization: { type: 'number' },
  //           tax_fee_company: { type: 'number' },
  //           tax_rate_company: { type: 'number' },
  //           tax_rate_provider: { type: 'number' },
  //           tax_fee_provider: { type: 'number' },
  //           tax_rate_market: { type: 'number' },
  //           created_at: { type: 'string', format: 'date-time' },
  //         },
  //       },
  //     },
  //   },
  // })
  // @ApiResponse({
  //   status: 400,
  //   description: 'Bad request - validation error or business rule violation',
  // })
  // async create(
  //   @Body() dto: CreateCurrencyConversionDto,
  //   @Req() { company }: { company: CompanyApiKey },
  // ) {
  //   return await this.currencyConversionService.create(company.id, dto);
  // }

  // @Get()
  // @ApiOperation({ summary: 'List company currency conversions' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'List of currency conversions with pagination',
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       data: {
  //         type: 'array',
  //         items: {
  //           type: 'object',
  //           properties: {
  //             id: { type: 'string' },
  //             status: { type: 'string' },
  //             original_amount: { type: 'number' },
  //             original_currency: { type: 'string' },
  //             converted_amount: { type: 'number' },
  //             converted_currency: { type: 'string' },
  //             amount_fee: { type: 'number' },
  //             tax_rate_market: { type: 'number' },
  //             created_at: { type: 'string', format: 'date-time' },
  //           },
  //         },
  //       },
  //       total: { type: 'number' },
  //       page: { type: 'number' },
  //       last_page: { type: 'number' },
  //     },
  //   },
  // })
  // async list(
  //   @Req() { company }: { company: CompanyApiKey },
  //   @Query(
  //     new ValidationPipe({
  //       transform: true,
  //       transformOptions: { enableImplicitConversion: true },
  //     }),
  //   )
  //   query: ListCurrencyConversionsQueryDto,
  // ) {
  //   return await this.currencyConversionService.list(company.id, query);
  // }

  // @Get('summary')
  // @ApiOperation({ summary: 'Get currency conversions summary' })
  // @ApiQuery({
  //   name: 'currency',
  //   required: false,
  //   enum: transaction_currency,
  //   description: 'Filter summary by specific currency',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Currency conversions summary',
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       total_conversions: { type: 'number' },
  //       pending_conversions: { type: 'number' },
  //       completed_conversions: { type: 'number' },
  //       total_volume: {
  //         type: 'object',
  //         properties: {
  //           original: { type: 'number' },
  //           converted: { type: 'number' },
  //           fees: { type: 'number' },
  //         },
  //       },
  //     },
  //   },
  // })
  // async getSummary(
  //   @Req() { company }: { company: CompanyApiKey },
  //   @Query('currency') currency?: transaction_currency,
  // ) {
  //   return await this.currencyConversionService.getSummary(
  //     company.id,
  //     currency,
  //   );
  // }

  // @Get(':id')
  // @ApiOperation({ summary: 'Get a specific currency conversion' })
  // @ApiParam({
  //   name: 'id',
  //   description: 'Currency conversion ID',
  //   type: 'string',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Currency conversion details',
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       id: { type: 'string' },
  //       status: { type: 'string' },
  //       original_amount: { type: 'number' },
  //       original_currency: { type: 'string' },
  //       converted_amount: { type: 'number' },
  //       converted_currency: { type: 'string' },
  //       amount_fee: { type: 'number' },
  //       amount_provider: { type: 'number' },
  //       amount_organization: { type: 'number' },
  //       tax_fee_company: { type: 'number' },
  //       tax_rate_company: { type: 'number' },
  //       tax_rate_provider: { type: 'number' },
  //       tax_fee_provider: { type: 'number' },
  //       tax_rate_market: { type: 'number' },
  //       created_at: { type: 'string', format: 'date-time' },
  //       updated_at: { type: 'string', format: 'date-time' },
  //       conversion_at: { type: 'string', format: 'date-time' },
  //     },
  //   },
  // })
  // @ApiResponse({
  //   status: 404,
  //   description: 'Currency conversion not found',
  // })
  // async findOne(
  //   @Req() { company }: { company: CompanyApiKey },
  //   @Param('id') id: string,
  // ) {
  //   return await this.currencyConversionService.findOne(company.id, id);
  // }
}
