import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private isDevelopment: boolean;

  constructor(private configService: ConfigService) {
    this.isDevelopment =
      this.configService.get<string>('NODE_ENV') !== 'production';

    if (this.isDevelopment) {
      this.bucketName = 'local-bucket';
      console.log('S3 Service running in mock mode for development');
    } else {
      this.s3Client = new S3Client({
        region: this.configService.get<string>('AWS_REGION')!,
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
          secretAccessKey: this.configService.get<string>(
            'AWS_SECRET_ACCESS_KEY',
          )!,
        },
      });
      this.bucketName = this.configService.get<string>('AWS_BUCKET_NAME')!;
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    if (this.isDevelopment) {
      console.log(
        `Mock upload: ${key} (${contentType}, ${buffer.length} bytes)`,
      );
      return `https://mock-s3.localhost/${key}`;
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
  }
}
