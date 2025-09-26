import { Global, Module } from '@nestjs/common';
import { EmailModule } from 'src/infrastructure/email/email.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [EmailModule, UserModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
