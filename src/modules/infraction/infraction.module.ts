import { Module } from '@nestjs/common';
import { InfractionService } from './services/infraction.service';
import { InfractionRepository } from './repositories/infraction.repository';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Module({
  providers: [InfractionService, InfractionRepository, PrismaService],
  exports: [InfractionService],
})
export class InfractionModule {}
