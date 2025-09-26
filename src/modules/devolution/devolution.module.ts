import { Global, Module } from '@nestjs/common';
import { DevolutionService } from './services/devolution.service';
import { DevolutionRepository } from './repositories/devolution.repository';

@Global()
@Module({
  imports: [],
  providers: [DevolutionService, DevolutionRepository],
  exports: [DevolutionService],
})
export class DevolutionModule {}
