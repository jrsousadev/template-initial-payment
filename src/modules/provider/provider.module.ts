import { Module } from '@nestjs/common';
import { ProviderRepository } from './repositories/provider.repository';
import { ProviderService } from './services/provider.service';
import { ProviderController } from './controllers/provider.controller';
import {
  ProviderSubAccountRepository,
  ProviderTaxConfigRepository,
} from './repositories/provider-tax-config.repository';
import { CompanyRepository } from '../company/repositories/company.repository';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [CompanyModule],
  controllers: [ProviderController],
  providers: [
    ProviderRepository,
    ProviderService,
    ProviderTaxConfigRepository,
    ProviderSubAccountRepository,
    CompanyRepository,
  ],
})
export class ProviderModule {}
