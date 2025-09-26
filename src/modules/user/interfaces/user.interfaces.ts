import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'usr_cm3x7n8f70000vs6g5jkg5hkn',
  })
  id: string;

  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User email',
    example: 'john@example.com',
  })
  email: string;

  @ApiPropertyOptional({
    description: 'User document',
    example: '12345678901',
    nullable: true,
  })
  document: string | null;

  @ApiProperty({
    description: 'User type',
    example: 'INDIVIDUAL',
  })
  type_user: string;

  @ApiProperty({
    description: 'User phone',
    example: '+5511999999999',
  })
  phone: string;

  @ApiProperty({
    description: 'User status',
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    description: 'Two-factor authentication enabled',
    example: false,
  })
  two_fa_enabled: boolean;

  @ApiProperty({
    description: 'Whether user has uploaded documents',
    example: true,
  })
  has_documents: boolean;

  @ApiProperty({
    description: 'User creation date',
    example: '2024-12-23T10:00:00Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'User last update date',
    example: '2024-12-23T10:00:00Z',
  })
  updated_at: string;
}

export class UserDocumentDto {
  @ApiProperty({
    description: 'Document ID',
    example: 'doc_cm3x7n8f70000vs6g5jkg5hkn',
  })
  id: string;

  @ApiProperty({
    description: 'Document front image URL',
    example: 'https://s3.amazonaws.com/bucket/document-front.jpg',
  })
  document_front_url: string;

  @ApiProperty({
    description: 'Document back image URL',
    example: 'https://s3.amazonaws.com/bucket/document-back.jpg',
  })
  document_back_url: string;

  @ApiProperty({
    description: 'Document selfie image URL',
    example: 'https://s3.amazonaws.com/bucket/document-selfie.jpg',
  })
  document_selfie_url: string;

  @ApiProperty({
    description: 'Document upload date',
    example: '2024-12-23T10:00:00Z',
  })
  uploaded_at: string;
}

export class UserDocumentsResponseDto {
  @ApiPropertyOptional({
    description: 'User documents information',
    type: UserDocumentDto,
    nullable: true,
  })
  documents: UserDocumentDto | null;

  @ApiPropertyOptional({
    description: 'Response message when no documents are found',
    example: 'No documents uploaded yet',
  })
  message?: string;
}
