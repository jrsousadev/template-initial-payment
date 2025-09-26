import { SQSClient } from '@aws-sdk/client-sqs';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SqsModule } from '@ssut/nestjs-sqs';
import { S3Service } from './s3/s3.service';

@Module({
  imports: [
    SqsModule.registerAsync({
      useFactory: async (configService: ConfigService) => {
        const queueUrl = configService.get<string>('SQS_QUEUE_URL');
        const region = configService.get<string>('AWS_REGION', 'us-east-2');
        const accessKeyId = configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        );

        return {
          consumers: [],
          producers: [
            {
              name: 'webhook-queue',
              queueUrl: queueUrl!,
              sqs: new SQSClient({
                region,
                credentials: {
                  accessKeyId: accessKeyId!,
                  secretAccessKey: secretAccessKey!,
                },
              }),
            },
          ],
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [S3Service],
  exports: [S3Service],
})
export class AwsModule {}
