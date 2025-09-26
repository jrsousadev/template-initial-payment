import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LogDocument = Log & Document;

@Schema({
  timestamps: true,
  collection: 'logs',
})
export class Log {
  @Prop({ required: true, index: true })
  level: string; // 'info', 'warn', 'error', 'debug'

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ index: true })
  service: string;

  @Prop()
  userId?: string;

  @Prop()
  requestId?: string;

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  method?: string;

  @Prop()
  endpoint?: string;

  @Prop()
  statusCode?: number;

  @Prop()
  responseTime?: number;

  @Prop({ type: Object })
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export const LogSchema = SchemaFactory.createForClass(Log);

// Índices para melhorar performance de consultas
LogSchema.index({ createdAt: -1 });
LogSchema.index({ level: 1, createdAt: -1 });
LogSchema.index({ service: 1, createdAt: -1 });
LogSchema.index({ userId: 1, createdAt: -1 });
