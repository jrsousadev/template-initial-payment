import { Module } from '@nestjs/common';
import { AwsModule } from 'src/infrastructure/aws/aws.module';
import { UserController } from './controllers/user.controller';
import { UserDocumentRepository } from './repositories/user-document.repository';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { EmailModule } from 'src/infrastructure/email/email.module';

@Module({
  imports: [AwsModule, EmailModule],
  controllers: [UserController],
  providers: [UserService, UserRepository, UserDocumentRepository],
  exports: [UserService, UserRepository, UserDocumentRepository],
})
export class UserModule {}
