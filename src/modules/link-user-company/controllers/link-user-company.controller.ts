import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CommonAuthErrors } from 'src/common/decorators/common-errors.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import {
  AcceptInviteDto,
  InviteUserToCompanyDto,
  ListCompanyMembersQueryDto,
  UpdateUserPermissionsDto,
} from '../dto/link-user-company.dto';
import {
  AcceptInviteResponseDto,
  CompanyAccessSummaryDto,
  CompanyMemberListResponseDto,
  InviteUserResponseDto,
  MemberActionResponseDto,
  MessageResponseDto,
  UserCompanyListResponseDto,
} from '../interfaces/link-user-company.interfaces';
import { LinkUserCompanyService } from '../services/link-user-company.service';

@ApiTags('Company Members')
@Controller('link-user-company')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class LinkUserCompanyController {
  constructor(
    private readonly linkUserCompanyService: LinkUserCompanyService,
  ) {}

  // ========== CONVITES ==========

  @Post(':companyId/members/invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invite a user to join the company',
    description:
      'Send an invitation email to a user to join the company with specified permissions. Only company owners can send invitations.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: 'cmp_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation sent successfully',
    type: InviteUserResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeForbidden: true,
    includeConflict: true,
    customMessages: {
      badRequest: 'Invalid invitation data or user already invited',
      forbidden: 'Only company owners can invite members',
      conflict: 'User already has access to this company',
    },
  })
  async inviteUser(
    @Param('companyId') companyId: string,
    @Body() dto: InviteUserToCompanyDto,
    @Req() request: any,
  ) {
    return await this.linkUserCompanyService.inviteUser(
      companyId,
      request.user.id,
      dto,
    );
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept a company invitation',
    description:
      'Accept a pending company invitation using the invitation token received via email. The invitation must be valid and not expired.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    type: AcceptInviteResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    customMessages: {
      badRequest: 'Invalid or expired invitation token',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Invitation not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async acceptInvite(@Body() dto: AcceptInviteDto, @Req() request: any) {
    return await this.linkUserCompanyService.acceptInvite(request.user.id, dto);
  }

  // ========== MEMBROS ==========

  @Get(':companyId/members')
  @ApiOperation({
    summary: 'List company members',
    description:
      'Retrieve a paginated list of all company members with their permissions and user information. Supports filtering by member type and banned status.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: 'cmp_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['OWNED', 'GUEST'],
    description: 'Filter by member type',
  })
  @ApiQuery({
    name: 'include_banned',
    required: false,
    type: Boolean,
    description: 'Include banned members (default: false)',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'List of company members with pagination',
    type: CompanyMemberListResponseDto,
  })
  @CommonAuthErrors({
    includeForbidden: true,
    customMessages: {
      forbidden: 'You do not have access to this company',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Company not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Company not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async listMembers(
    @Param('companyId') companyId: string,
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    query: ListCompanyMembersQueryDto,
    @Req() request: any,
  ) {
    return await this.linkUserCompanyService.listMembers(
      companyId,
      request.user.id,
      query,
    );
  }

  @Get(':companyId/members/summary')
  @ApiOperation({
    summary: 'Get company access summary',
    description:
      'Retrieve a summary of company access statistics including total members, owners, guests, pending invitations, and banned members.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: 'cmp_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 200,
    description: 'Company access summary with statistics',
    type: CompanyAccessSummaryDto,
  })
  @CommonAuthErrors({
    includeForbidden: true,
    customMessages: {
      forbidden: 'You do not have access to this company',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Company not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Company not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async getAccessSummary(
    @Param('companyId') companyId: string,
    @Req() request: any,
  ) {
    return await this.linkUserCompanyService.getAccessSummary(
      companyId,
      request.user.id,
    );
  }

  @Patch(':companyId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update member permissions',
    description:
      'Update the permissions of a company member. Only company owners can modify member permissions.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: 'cmp_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID of the member to update',
    example: 'usr_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 200,
    description: 'Member permissions updated successfully',
    type: MemberActionResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Invalid permission data',
      forbidden: 'Only company owners can update member permissions',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Member not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Member not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async updateMemberPermissions(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserPermissionsDto,
    @Req() request: any,
  ) {
    return await this.linkUserCompanyService.updateMemberPermissions(
      companyId,
      userId,
      request.user.id,
      dto,
    );
  }

  @Delete(':companyId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove member from company',
    description:
      'Permanently remove a member from the company. Only company owners can remove members. The member will lose all access to the company.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: 'cmp_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID of the member to remove',
    example: 'usr_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 200,
    description: 'Member removed successfully',
    type: MessageResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Cannot remove company owner',
      forbidden: 'Only company owners can remove members',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Member not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Member not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async removeMember(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
    @Req() request: any,
  ) {
    return await this.linkUserCompanyService.removeMember(
      companyId,
      userId,
      request.user.id,
    );
  }

  @Post(':companyId/members/:userId/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ban member from company',
    description:
      'Temporarily ban a member from the company. Banned members cannot access company resources but their access record is preserved. Only company owners can ban members.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: 'cmp_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID of the member to ban',
    example: 'usr_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 200,
    description: 'Member banned successfully',
    type: MemberActionResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Cannot ban company owner or already banned member',
      forbidden: 'Only company owners can ban members',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Member not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Member not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async banMember(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
    @Req() request: any,
  ) {
    return await this.linkUserCompanyService.banMember(
      companyId,
      userId,
      request.user.id,
    );
  }

  @Post(':companyId/members/:userId/unban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unban member from company',
    description:
      'Remove the ban from a previously banned member, restoring their access to the company. Only company owners can unban members.',
  })
  @ApiParam({
    name: 'companyId',
    description: 'Company ID',
    example: 'cmp_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID of the member to unban',
    example: 'usr_cm3x7n8f70000vs6g5jkg5hkn',
  })
  @ApiResponse({
    status: 200,
    description: 'Member unbanned successfully',
    type: MemberActionResponseDto,
  })
  @CommonAuthErrors({
    includeBadRequest: true,
    includeForbidden: true,
    customMessages: {
      badRequest: 'Member is not currently banned',
      forbidden: 'Only company owners can unban members',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Member not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Member not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async unbanMember(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
    @Req() request: any,
  ) {
    return await this.linkUserCompanyService.unbanMember(
      companyId,
      userId,
      request.user.id,
    );
  }

  // ========== EMPRESAS DO USUÁRIO ==========

  @Get('my-companies')
  @ApiOperation({
    summary: 'List companies the user has access to',
    description:
      'Retrieve all companies that the authenticated user has access to, either as an owner or guest member.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of user companies with access details',
    type: UserCompanyListResponseDto,
  })
  @CommonAuthErrors({
    includeForbidden: false,
    includeUnauthorized: true,
  })
  async getUserCompanies(@Req() request: any) {
    return await this.linkUserCompanyService.getUserCompanies(request.user.id);
  }
}
