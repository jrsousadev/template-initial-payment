import { Module } from '@nestjs/common';
import { CustomerService } from './services/customer.service';
import { CustomerRepository } from './repositories/customer.repository';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Module({
  providers: [CustomerService, CustomerRepository, PrismaService],
  exports: [CustomerService],
})
export class CustomerModule {}
