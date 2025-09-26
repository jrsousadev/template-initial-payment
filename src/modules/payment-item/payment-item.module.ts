import { Module } from '@nestjs/common';
import { PaymentItemService } from './services/payment-item.service';
import { PaymentItemRepository } from './repositories/payment-item.repository';

@Module({
  providers: [PaymentItemService, PaymentItemRepository],
  exports: [PaymentItemService],
})
export class PaymentItemModule {}
