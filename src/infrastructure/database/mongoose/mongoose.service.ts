import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log, LogDocument } from './schemas/log.schema';

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  service: string;
  metadata?: Record<string, any>;
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  responseTime?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

@Injectable()
export class MongooseLogService {
  constructor(@InjectModel(Log.name) private logModel: Model<LogDocument>) {}

  async createLog(logEntry: LogEntry): Promise<Log> {
    const log = new this.logModel(logEntry);
    return log.save();
  }

  async createBulkLogs(logEntries: LogEntry[]): Promise<void> {
    await this.logModel.insertMany(logEntries, { ordered: false });
  }

  async findLogs(filters: {
    level?: string;
    service?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<Log[]> {
    const query: any = {};

    if (filters.level) query.level = filters.level;
    if (filters.service) query.service = filters.service;
    if (filters.userId) query.userId = filters.userId;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    return this.logModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 100)
      .exec();
  }

  async deleteOldLogs(daysToKeep: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    await this.logModel.deleteMany({
      createdAt: { $lt: cutoffDate },
    });
  }

  async getLogStats(service?: string): Promise<any> {
    const match: any = {};
    if (service) match.service = service;

    return this.logModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 },
        },
      },
    ]);
  }
}
