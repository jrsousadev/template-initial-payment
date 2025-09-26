import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';

@Injectable()
export class UserDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.user_documentCreateInput) {
    return this.prisma.user_document.create({
      data,
    });
  }

  async findById(id: string) {
    return this.prisma.user_document.findUnique({
      where: { id },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.user_document.findUnique({
      where: { user_id: userId },
    });
  }

  async update(id: string, data: Prisma.user_documentUpdateInput) {
    return this.prisma.user_document.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.user_document.delete({
      where: { id },
    });
  }
}
