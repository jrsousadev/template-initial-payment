import { Module } from '@nestjs/common';
import { PaymentController } from './controllers/payment.controller';
import { PaymentService } from './services/payment.service';
import { PaymentProcessorService } from './services/payment-processor.service';
import { PaymentFeeCalculatorService } from './services/payment-fee-calculator.service';
import { PaymentValidatorService } from './services/payment-validator.service';
import { PaymentRepository } from './repositories/payment.repository';
import { CustomerModule } from '../customer/customer.module';
import { PaymentItemModule } from '../payment-item/payment-item.module';

@Module({
  imports: [CustomerModule, PaymentItemModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentProcessorService,
    PaymentFeeCalculatorService,
    PaymentValidatorService,
    PaymentRepository,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
