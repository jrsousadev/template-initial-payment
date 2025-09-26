import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { isPublic } from 'src/common/decorators/public-route.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import {
  PublicAuthErrors,
  ProtectedAuthErrors,
  FileUploadAuthErrors,
} from 'src/common/decorators/common-errors.decorator';
import {
  AuthenticatedUserDto,
  ChangePasswordDto,
  DocumentUploadResponseDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponse,
  LoginResponseDto,
  LogoutDto,
  MessageResponseDto,
  RefreshTokenDto,
  ResetPasswordDto,
  SelectCompanyDto,
  SelectCompanyResponseDto,
  UserRegistrationResponseDto,
  VerifyTokenDto,
  VerifyTokenResponseDto,
} from './auth.interfaces';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/user.dto';
import { UserService } from '../user/services/user.service';
import { FastifyRequest } from 'fastify';

interface FastifyRequestWithMultipart extends FastifyRequest {
  isMultipart(): boolean;
  parts(): AsyncIterableIterator<any>;
  user: any;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('register')
  @isPublic()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'User registration',
    description:
      'Create a new user account with email, password, and personal information',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserRegistrationResponseDto,
  })
  @PublicAuthErrors({
    badRequest: 'Invalid input data or validation errors',
    conflict: 'Email already exists',
  })
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      type_user: user.type_user,
      created_at: user.created_at,
    };
  }

  @Post('login')
  @isPublic()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticate user with email and password, returns access and refresh tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @PublicAuthErrors({
    badRequest: 'Invalid request data',
    unauthorized: 'Invalid credentials or account not verified',
    forbidden: 'Account is blocked or inactive',
  })
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return await this.authService.login(dto);
  }

  @Post('refresh')
  @isPublic()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Generate new access token using valid refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: LoginResponseDto,
  })
  @PublicAuthErrors({
    badRequest: 'Invalid request data',
    unauthorized: 'Invalid or expired refresh token',
  })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<LoginResponse> {
    return await this.authService.refreshToken(dto);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout user',
    description: 'Invalidate user session and optionally revoke refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    type: MessageResponseDto,
  })
  @ProtectedAuthErrors()
  async logout(
    @Req() request: any,
    @Body() body?: LogoutDto,
  ): Promise<{ message: string }> {
    await this.authService.logout(request.user.id, body?.refresh_token);
    return { message: 'Logout successful' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user info',
    description:
      'Retrieve authenticated user information including associated companies and permissions',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user information',
    type: AuthenticatedUserDto,
  })
  @ProtectedAuthErrors()
  async getCurrentUser(@Req() request: any) {
    return request.user;
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change user password',
    description:
      'Change authenticated user password by providing current password and new password',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: MessageResponseDto,
  })
  @ProtectedAuthErrors({
    badRequest: 'Invalid current password or validation errors',
  })
  async changePassword(
    @Req() request: any,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(request.user.id, dto);
    return { message: 'Password changed successfully' };
  }

  @Post('forgot-password')
  @isPublic()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Send password reset email to user (always returns success for security)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Password reset email sent (or email not found - returns success for security)',
    type: MessageResponseDto,
  })
  @PublicAuthErrors({
    badRequest: 'Invalid email format',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  @isPublic()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with token',
    description:
      'Reset user password using valid reset token received via email',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    type: MessageResponseDto,
  })
  @PublicAuthErrors({
    badRequest: 'Invalid or expired token, or validation errors',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successful' };
  }

  @Post('verify-token')
  @isPublic()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify if token is valid',
    description: 'Validate JWT token and return payload if valid',
  })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
    type: VerifyTokenResponseDto,
  })
  @PublicAuthErrors({
    badRequest: 'Invalid request data',
  })
  async verifyToken(
    @Body() body: VerifyTokenDto,
  ): Promise<{ valid: boolean; payload?: any }> {
    try {
      const payload = await this.authService.validateToken(body.token);
      return { valid: true, payload };
    } catch {
      return { valid: false };
    }
  }

  @Post('select-company')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Select active company for user',
    description:
      'Set the active company context for the authenticated user session',
  })
  @ApiResponse({
    status: 200,
    description: 'Company selected successfully',
    type: SelectCompanyResponseDto,
  })
  @ProtectedAuthErrors({
    badRequest: 'Invalid company ID format',
    forbidden: 'User does not have access to this company',
  })
  async selectCompany(
    @Req() request: any,
    @Body() body: SelectCompanyDto,
  ): Promise<{ message: string; company: any }> {
    const company = request.user.companies?.find(
      (c: any) => c.id === body.company_id,
    );

    if (!company) {
      throw new ForbiddenException('You do not have access to this company');
    }

    // Aqui você pode salvar a empresa selecionada em uma tabela de preferências
    await this.authService.updateLastAccessedCompany(
      request.user.id,
      body.company_id,
    );

    return {
      message: 'Company selected successfully',
      company,
    };
  }

  @Post('upload-documents')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload user documents',
    description:
      'Upload identity verification documents (front, back, and selfie) for KYC compliance',
  })
  @ApiBody({
    description: 'Document files for verification',
    schema: {
      type: 'object',
      properties: {
        document_front: {
          type: 'string',
          format: 'binary',
          description: 'Front side of identity document (JPG, PNG, PDF)',
        },
        document_back: {
          type: 'string',
          format: 'binary',
          description: 'Back side of identity document (JPG, PNG, PDF)',
        },
        document_selfie: {
          type: 'string',
          format: 'binary',
          description: 'Selfie photo with document (JPG, PNG)',
        },
      },
      required: ['document_front', 'document_back', 'document_selfie'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Documents uploaded successfully',
    type: DocumentUploadResponseDto,
  })
  @FileUploadAuthErrors({
    badRequest: 'Missing required documents or invalid file format',
  })
  async uploadDocuments(@Req() request: FastifyRequestWithMultipart) {
    const currentUser = request.user;
    const parts = request.parts();
    const files: Record<string, any> = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        files[part.fieldname] = {
          filename: part.filename,
          mimetype: part.mimetype,
          buffer: buffer,
          size: buffer.length,
        };
      }
    }

    if (
      !files.document_front ||
      !files.document_back ||
      !files.document_selfie
    ) {
      throw new BadRequestException(
        'Please upload all required documents: document_front, document_back, and document_selfie',
      );
    }

    const userDocument = await this.userService.uploadDocuments(
      currentUser.id,
      {
        document_front: files.document_front,
        document_back: files.document_back,
        document_selfie: files.document_selfie,
      },
    );

    return {
      message: 'Documents uploaded successfully',
      document: {
        id: userDocument.id,
        document_front_url: userDocument.document_front_url,
        document_back_url: userDocument.document_back_url,
        document_selfie_url: userDocument.document_selfie_url,
        created_at: userDocument.created_at,
      },
      user_status: 'ACTIVE',
    };
  }
}
