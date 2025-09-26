import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Log, LogSchema } from './schemas/log.schema';
import { MongooseLogService } from './mongoose.service';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/logs',
        connectionFactory: (connection) => {
          connection.on('connected', () => {
            console.log('MongoDB connected successfully');
          });
          connection.on('error', (error) => {
            console.error('MongoDB connection error:', error);
          });
          return connection;
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }]),
  ],
  providers: [MongooseLogService],
  exports: [MongooseLogService],
})
export class MongooseLogModule {}
