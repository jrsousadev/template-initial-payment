import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { webhook_log_status, webhook_type } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';

export class CreateWebhookDto {
  @IsEnum(webhook_type)
  @IsNotEmpty()
  type: webhook_type;

  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  companyId: string;
}

export class UpdateWebhookDto extends PartialType(CreateWebhookDto) {}

export class CreateWebhookLogDto {
  @IsEnum(webhook_type)
  @IsNotEmpty()
  type: webhook_type;

  @IsEnum(webhook_log_status)
  @IsOptional()
  status?: webhook_log_status;

  @IsObject()
  @IsNotEmpty()
  payload: any;

  @IsNumber()
  @IsOptional()
  retryLimit?: number;

  @IsNumber()
  @IsOptional()
  retryDelay?: number;

  @IsString()
  @IsNotEmpty()
  webhookId: string;

  @IsString()
  @IsOptional()
  paymentId?: string;

  @IsString()
  @IsOptional()
  withdrawalId?: string; // ADD

  @IsString()
  @IsNotEmpty()
  companyId: string;
}

// dto/webhook-response.dto.ts
export class WebhookResponseDto {
  id: string;
  type: string;
  url: string;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
  totalLogs?: number;
  successRate?: number;
}

export class WebhookLogResponseDto {
  id: string;
  type: string;
  status: string;
  payload: any;
  response?: any;
  retryCount: number;
  retryLimit: number;
  retryAt?: Date;
  createdAt: Date;
  completedAt?: Date;
  webhookId: string;
  paymentId?: string;
}

export class WebhookFiltersDto {
  @IsEnum(webhook_type)
  @IsOptional()
  type?: webhook_type;

  @IsString()
  @IsOptional()
  companyId?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class WebhookLogFiltersDto extends WebhookFiltersDto {
  @IsEnum(webhook_log_status)
  @IsOptional()
  status?: webhook_log_status;

  @IsString()
  @IsOptional()
  webhookId?: string;

  @IsString()
  @IsOptional()
  paymentId?: string;
}
