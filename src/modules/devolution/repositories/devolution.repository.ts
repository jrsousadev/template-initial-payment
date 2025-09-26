import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { Devolution } from '../entities/devolution.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class DevolutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.devolutionCreateInput): Promise<Devolution> {
    const devolution = await this.prisma.devolution.create({
      data: {
        ...data,
        id: data.id || UniqueIDGenerator.generate(),
      },
    });

    return new Devolution(devolution);
  }

  async createMany(data: Prisma.devolutionCreateManyInput[]): Promise<number> {
    if (data.length === 0) return 0;

    const devolutionsData = data.map((dev) => ({
      ...dev,
      id: dev.id || UniqueIDGenerator.generate(),
    }));

    const result = await this.prisma.devolution.createMany({
      data: devolutionsData,
      skipDuplicates: true,
    });

    return result.count;
  }
}
