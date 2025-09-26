import {
  webhook_log as PrismaWebhookLog,
  webhook_log_status,
  webhook_type,
} from '@prisma/client';

export class WebhookLog implements PrismaWebhookLog {
  id: string;
  type: webhook_type;
  status: webhook_log_status;
  url: string;
  payload: any;
  response: any;
  retry_count: number;
  retry_limit: number;
  retry_delay: number;
  retry_at: Date | null;
  created_at: Date;
  completed_at: Date | null;
  updated_at: Date | null;
  deleted_at: Date | null;
  webhook_id: string;
  payment_id: string | null;
  withdrawal_id: string | null;
  infraction_id: string | null;
  company_id: string;

  constructor(data: PrismaWebhookLog) {
    Object.assign(this, data);
  }

  canRetry(): boolean {
    return (
      !this.isDeleted() &&
      this.status === 'FAILED' &&
      this.retry_count < this.retry_limit
    );
  }

  shouldRetryNow(): boolean {
    if (!this.canRetry()) return false;
    if (!this.retry_at) return true;
    return new Date() >= this.retry_at;
  }

  incrementRetry(): void {
    this.retry_count++;
    this.status = 'RETRYING';
    this.retry_at = this.calculateNextRetryTime();
    this.updated_at = new Date();
  }

  markAsCompleted(response: any): void {
    this.status = 'COMPLETED';
    this.response = response;
    this.completed_at = new Date();
    this.updated_at = new Date();
  }

  markAsFailed(error: any): void {
    this.status = 'FAILED';
    this.response = error;
    this.updated_at = new Date();
  }

  private calculateNextRetryTime(): Date {
    // Exponential backoff: delay * 2^retryCount
    const backoffDelay = this.retry_delay * Math.pow(2, this.retry_count);
    return new Date(Date.now() + backoffDelay);
  }

  getExecutionTime(): number | null {
    if (!this.completed_at) return null;
    return this.completed_at.getTime() - this.created_at.getTime();
  }

  isDeleted(): boolean {
    return this.deleted_at !== null;
  }

  isActive(): boolean {
    return !this.isDeleted();
  }
}
