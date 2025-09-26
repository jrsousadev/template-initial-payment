import {
  webhook,
  webhook_log,
  webhook_type,
  webhook_log_status,
} from '@prisma/client';

export interface IWebhookWithLogs extends webhook {
  webhook_log: webhook_log[];
}

export interface IWebhookLogWithRelations extends webhook_log {
  webhook: webhook;
  payment?: any;
  company?: any;
}

export interface WebhookSendResult {
  success: boolean;
  status: webhook_log_status;
  response?: any;
  error?: string;
  shouldRetry?: boolean;
}

export interface WebhookRetryConfig {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier?: number;
}

export interface WebhookStats {
  totalSent: number;
  successful: number;
  failed: number;
  pending: number;
  retrying: number;
  successRate: number;
}
