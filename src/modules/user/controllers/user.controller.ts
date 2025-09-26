// user.controller.ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CommonAuthErrors } from 'src/common/decorators/common-errors.decorator';
import { UserService } from '../services/user.service';
import {
  UserProfileResponseDto,
  UserDocumentsResponseDto,
} from '../interfaces/user.interfaces';

@ApiTags('Users')
@Controller('users')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get user profile',
    description:
      'Retrieve the authenticated user profile information including personal data and account status.',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: UserProfileResponseDto,
  })
  @CommonAuthErrors({
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      unauthorized: 'Invalid or expired authentication token',
      forbidden: 'Access denied to user profile',
    },
  })
  async getProfile(@Req() request: any) {
    const currentUser = request.user;
    const profile = await this.userService.getProfile(currentUser.id);

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      document: profile.document,
      type_user: profile.type_user,
      phone: profile.phone,
      status: profile.status,
      two_fa_enabled: profile.two_fa_enabled,
      has_documents: !!profile.user_document,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  @Get('documents')
  @ApiOperation({
    summary: 'Get user documents',
    description:
      'Retrieve the authenticated user uploaded documents including ID photos and selfie verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'User documents retrieved successfully',
    type: UserDocumentsResponseDto,
  })
  @CommonAuthErrors({
    includeUnauthorized: true,
    includeForbidden: true,
    customMessages: {
      unauthorized: 'Invalid or expired authentication token',
      forbidden: 'Access denied to user documents',
    },
  })
  async getDocuments(@Req() request: any) {
    const currentUser = request.user;
    const documents = await this.userService.getDocuments(currentUser.id);

    if (!documents) {
      return {
        message: 'No documents uploaded yet',
        documents: null,
      };
    }

    return {
      documents: {
        id: documents.id,
        document_front_url: documents.document_front_url,
        document_back_url: documents.document_back_url,
        document_selfie_url: documents.document_selfie_url,
        uploaded_at: documents.created_at,
      },
    };
  }
}
