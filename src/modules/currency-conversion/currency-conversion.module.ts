import { Module } from '@nestjs/common';
import { CompanyModule } from 'src/modules/company/company.module';
import { CurrencyConversionController } from './controllers/currency-conversion.controller';
import { CurrencyConversionRepository } from './repositories/currency-conversion.repository';
import { CurrencyConversionService } from './services/currency-conversion.service';

@Module({
  imports: [CompanyModule],
  controllers: [CurrencyConversionController],
  providers: [CurrencyConversionService, CurrencyConversionRepository],
  exports: [CurrencyConversionService],
})
export class CurrencyConversionModule {}
