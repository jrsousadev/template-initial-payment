import { Global, Module } from '@nestjs/common';
import { ApiKeysService } from './services/api-key.service';
import { ApiKeysRepository } from './repositories/api-key.repository';
import { ApiKeysController } from './controllers/api-key.controller';
import { CompanyRepository } from '../company/repositories/company.repository';
import { CompanyModule } from '../company/company.module';

@Global()
@Module({
  imports: [CompanyModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeysRepository, CompanyRepository],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
