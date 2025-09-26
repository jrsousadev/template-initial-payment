import { Global, Module } from '@nestjs/common';
import { EmailModule } from 'src/infrastructure/email/email.module';
import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';
import { LinkUserCompanyController } from './controllers/link-user-company.controller';
import { LinkUserCompanyRepository } from './repositories/link-user-company.repository';
import { LinkUserCompanyService } from './services/link-user-company.service';

@Global()
@Module({
  imports: [UserModule, CompanyModule, EmailModule],
  controllers: [LinkUserCompanyController],
  exports: [LinkUserCompanyService, LinkUserCompanyRepository],
  providers: [LinkUserCompanyService, LinkUserCompanyRepository],
})
export class LinkUserCompanyModule {}
