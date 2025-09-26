// company.module.ts
import { Module } from '@nestjs/common';
import { WalletRepository } from './repositories/wallet.repository';
import { WalletService } from './services/wallet.service';

@Module({
  providers: [WalletRepository, WalletService],
  exports: [WalletRepository, WalletService],
})
export class WalletModule {}
