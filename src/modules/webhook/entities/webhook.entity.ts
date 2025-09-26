import { webhook as PrismaWebhook, webhook_type } from '@prisma/client';

export class Webhook implements PrismaWebhook {
  id: string;
  type: webhook_type;
  url: string;
  company_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;

  constructor(data: PrismaWebhook) {
    Object.assign(this, data);
    if (!this.isDeleted()) {
      this.validate();
    }
  }

  private validate(): void {
    if (!this.isValidUrl(this.url)) {
      throw new Error('Invalid webhook URL');
    }

    if (!this.isSecureUrl(this.url)) {
      throw new Error('Webhook URL must use HTTPS');
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isSecureUrl(url: string): boolean {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:';
  }

  isActive(): boolean {
    return !this.isDeleted();
  }

  isDeleted(): boolean {
    return this.deleted_at !== null;
  }

  canReceiveType(type: webhook_type): boolean {
    return this.type === type && this.isActive();
  }
}
