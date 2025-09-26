import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  CreateWebhookDto,
  WebhookFiltersDto,
  UpdateWebhookDto,
  WebhookLogFiltersDto,
} from '../dto/webhook.dto';
import { WebhookService } from '../services/webhook.service';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller('webhooks')
// @UseGuards(AuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createWebhookDto: CreateWebhookDto) {
    return this.webhookService.create(createWebhookDto);
  }

  @Get()
  async findAll(@Query() filters: WebhookFiltersDto) {
    return this.webhookService.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.webhookService.findOne(id);
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    return this.webhookService.getWebhookStats(id);
  }

  @Get(':id/logs')
  async getWebhookLogs(
    @Param('id') id: string,
    @Query() filters: WebhookLogFiltersDto,
  ) {
    return this.webhookService.findAllLogs({
      ...filters,
      webhookId: id,
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWebhookDto: UpdateWebhookDto,
  ) {
    return this.webhookService.update(id, updateWebhookDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.webhookService.remove(id);
  }

  // ===== WEBHOOK LOG ENDPOINTS =====

  @Get('logs')
  async findAllLogs(@Query() filters: WebhookLogFiltersDto) {
    return this.webhookService.findAllLogs(filters);
  }

  @Get('logs/:id')
  async findLogById(@Param('id') id: string) {
    return this.webhookService.findLogById(id);
  }
}
