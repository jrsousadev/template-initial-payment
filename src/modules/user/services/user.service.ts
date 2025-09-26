// user.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { S3Service } from 'src/infrastructure/aws/s3/s3.service';
import { CreateUserDto } from '../dto/user.dto';
import { UserDocumentRepository } from '../repositories/user-document.repository';
import { UserRepository } from '../repositories/user.repository';
import { EmailService } from 'src/infrastructure/email/email.service';
import { DocumentValidator } from 'src/common/utils/document.util';

interface FileUpload {
  filename: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userDocumentRepository: UserDocumentRepository,
    private readonly s3Service: S3Service,
    private readonly emailService: EmailService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingEmail = await this.userRepository.findByEmail(
      createUserDto.email,
    );
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const existingDocument = await this.userRepository.findByDocument(
      createUserDto.document,
    );
    if (existingDocument) {
      throw new ConflictException('Document already registered');
    }

    if (!DocumentValidator.isValid(createUserDto.document)) {
      throw new BadRequestException('Invalid document format');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.userRepository.create({
      name: createUserDto.name,
      email: createUserDto.email.toLowerCase(),
      document: createUserDto.document,
      phone: createUserDto.phone,
      password: hashedPassword,
      type_user: createUserDto.type_user || 'CPF',
      status: 'AWAITING_DOCUMENTS',
      two_fa_enabled: false,
    });

    const { password, two_fa_secret, ...userWithoutSensitive } = user;

    //await this.emailService.sendEmail(user.email, 'Bem-vindo ao ShopFox', `Olá, ${user.name}, bem-vindo ao ShopFox!`);

    return userWithoutSensitive;
  }

  async uploadDocuments(
    userId: string,
    documents: {
      document_front: FileUpload;
      document_back: FileUpload;
      document_selfie: FileUpload;
    },
  ) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingDocuments =
      await this.userDocumentRepository.findByUserId(userId);
    if (existingDocuments) {
      throw new ConflictException(
        'Documents already uploaded. Contact support to update.',
      );
    }

    this.validateDocumentFiles(documents);

    const [frontUrl, backUrl, selfieUrl] = await Promise.all([
      this.s3Service.uploadBuffer(
        documents.document_front.buffer,
        `documents/${userId}/front.${this.getFileExtension(documents.document_front.mimetype)}`,
        documents.document_front.mimetype,
      ),
      this.s3Service.uploadBuffer(
        documents.document_back.buffer,
        `documents/${userId}/back.${this.getFileExtension(documents.document_back.mimetype)}`,
        documents.document_back.mimetype,
      ),
      this.s3Service.uploadBuffer(
        documents.document_selfie.buffer,
        `documents/${userId}/selfie.${this.getFileExtension(documents.document_selfie.mimetype)}`,
        documents.document_selfie.mimetype,
      ),
    ]);

    const userDocument = await this.userDocumentRepository.create({
      user: {
        connect: { id: userId },
      },
      document_front_url: frontUrl,
      document_back_url: backUrl,
      document_selfie_url: selfieUrl,
    });

    await this.userRepository.update(userId, {
      status: 'ACTIVE',
    });

    return userDocument;
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findByIdWithDocuments(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, two_fa_secret, ...userProfile } = user;

    return userProfile;
  }

  async getDocuments(userId: string) {
    const documents = await this.userDocumentRepository.findByUserId(userId);
    return documents;
  }

  private validateDocumentFiles(documents: {
    document_front: FileUpload;
    document_back: FileUpload;
    document_selfie: FileUpload;
  }): void {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];

    const files = [
      { file: documents.document_front, name: 'document_front' },
      { file: documents.document_back, name: 'document_back' },
      { file: documents.document_selfie, name: 'document_selfie' },
    ];

    for (const { file, name } of files) {
      if (!file) {
        throw new BadRequestException(`${name} is required`);
      }

      if (file.size > maxSize) {
        throw new BadRequestException(`${name} exceeds maximum size of 5MB`);
      }

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(`${name} must be JPEG or PNG format`);
      }
    }
  }

  private getFileExtension(mimetype: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
    };
    return extensions[mimetype] || 'jpg';
  }

  async findByEmail(email: string) {
    return await this.userRepository.findByEmail(email);
  }

  async findById(id: string) {
    return await this.userRepository.findById(id);
  }
}
