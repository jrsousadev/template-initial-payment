// company.module.ts
import { Module } from '@nestjs/common';
import { AwsModule } from 'src/infrastructure/aws/aws.module';
import { WalletModule } from '../wallet/wallet.module';
import { CompanyController } from './controllers/company.controller';
import { CompanyConfigRepository } from './repositories/company-config.repository';
import { CompanyDocumentRepository } from './repositories/company-document.repository';
import { CompanyTaxConfigRepository } from './repositories/company-tax-config.repository';
import { CompanyRepository } from './repositories/company.repository';
import { CompanyService } from './services/company.service';

@Module({
  imports: [AwsModule, WalletModule],
  controllers: [CompanyController],
  providers: [
    CompanyService,
    CompanyRepository,
    CompanyTaxConfigRepository,
    CompanyConfigRepository,
    CompanyDocumentRepository,
  ],
  exports: [
    CompanyService,
    CompanyRepository,
    CompanyTaxConfigRepository,
    CompanyConfigRepository,
    CompanyDocumentRepository,
  ],
})
export class CompanyModule {}
