import { Global, Module } from '@nestjs/common';
import { GatewayProviderFactoryService } from './gateway-provider-factory.service';

@Global()
@Module({
  providers: [GatewayProviderFactoryService],
  exports: [GatewayProviderFactoryService],
})
export class GatewayModule {}
