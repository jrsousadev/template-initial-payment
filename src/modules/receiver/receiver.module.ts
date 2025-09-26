import { Module } from '@nestjs/common';
import { ReceiverController } from './controllers/receiver.controller';
import { ReceiverService } from './services/receiver.service';
import { ReceiverRepository } from './repositories/receiver.repository';

@Module({
  imports: [],
  controllers: [ReceiverController],
  providers: [ReceiverService, ReceiverRepository],
  exports: [ReceiverService, ReceiverRepository],
})
export class ReceiverModule {}
