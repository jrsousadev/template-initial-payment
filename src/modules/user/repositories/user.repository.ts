// user.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.userCreateInput) {
    return this.prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Prisma.userUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByIdWithDocuments(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        user_document: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByDocument(document: string) {
    return this.prisma.user.findUnique({
      where: { document },
    });
  }

  async findMany(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.userWhereInput;
    orderBy?: Prisma.userOrderByWithRelationInput;
  }) {
    const { skip, take, where, orderBy } = params || {};

    return this.prisma.user.findMany({
      skip,
      take,
      where,
      orderBy,
    });
  }
}
