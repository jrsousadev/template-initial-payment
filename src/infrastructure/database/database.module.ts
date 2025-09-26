import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MongooseLogModule } from './mongoose/mongoose.module';
@Global()
@Module({
  providers: [PrismaService, MongooseLogModule],
  exports: [PrismaService, MongooseLogModule],
})
export class DatabaseModule {}
