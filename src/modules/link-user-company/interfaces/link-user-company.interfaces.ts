import { link_user_company_type } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface PaginationOptions {
  skip: number;
  take: number;
}

export interface CompanyMember {
  id: string;
  user_id: string;
  company_id: string;
  // organization_id: string;
  type: link_user_company_type;
  created_at: Date;
  updated_at: Date;
  banned_at: Date | null;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
}

export interface CompanyInvitation {
  id: string;
  company_id: string;
  invited_email: string;
  invited_by_user_id: string;
  token: string;
  type: link_user_company_type;
  permissions: {
    read_payment: boolean;
    write_payment: boolean;
    read_withdrawal: boolean;
    write_withdrawal: boolean;
  };
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CompanyMemberListResponse {
  data: CompanyMember[];
  total: number;
  page: number;
  last_page: number;
}

export interface CompanyMemberFilters {
  type?: link_user_company_type;
  include_banned?: boolean;
}

export interface InvitationTokenPayload {
  invitation_id: string;
  company_id: string;
  email: string;
  type: link_user_company_type;
  expires_at: number;
}

export interface CompanyAccessSummary {
  company_id: string;
  total_members: number;
  owners: number;
  guests: number;
  pending_invitations: number;
  banned_members: number;
}

// Swagger Response DTOs
export class InviteUserResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Invitation sent successfully',
  })
  message: string;

  @ApiProperty({ description: 'Invitation details' })
  invitation: {
    id: string;
    company_id: string;
    invited_email: string;
    type: link_user_company_type;
    expires_at: Date;
  };
}

export class AcceptInviteResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Invitation accepted successfully',
  })
  message: string;

  @ApiProperty({ description: 'Company access details' })
  access: {
    id: string;
    company_id: string;
    type: link_user_company_type;
    permissions: {
      read_payment: boolean;
      write_payment: boolean;
      read_withdrawal: boolean;
      write_withdrawal: boolean;
    };
  };
}

export class CompanyMemberDto {
  @ApiProperty({
    description: 'Member access ID',
    example: 'luc_cm3x7n8f70000vs6g5jkg5hkn',
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: 'usr_cm3x7n8f70000vs6g5jkg5hkn',
  })
  user_id: string;

  @ApiProperty({
    description: 'Company ID',
    example: 'cmp_cm3x7n8f70000vs6g5jkg5hkn',
  })
  company_id: string;

  @ApiProperty({ description: 'Access type', enum: link_user_company_type })
  type: link_user_company_type;

  @ApiProperty({ description: 'Permission to read payments', example: true })
  read_payment: boolean;

  @ApiProperty({ description: 'Permission to write payments', example: false })
  write_payment: boolean;

  @ApiProperty({ description: 'Permission to read withdrawals', example: true })
  read_withdrawal: boolean;

  @ApiProperty({
    description: 'Permission to write withdrawals',
    example: false,
  })
  write_withdrawal: boolean;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-12-23T10:00:00Z',
  })
  created_at: Date;

  @ApiPropertyOptional({
    description: 'Ban date if member is banned',
    example: null,
  })
  banned_at: Date | null;

  @ApiProperty({ description: 'User information' })
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
}

export class CompanyMemberListResponseDto {
  @ApiProperty({
    description: 'List of company members',
    type: [CompanyMemberDto],
  })
  data: CompanyMemberDto[];

  @ApiProperty({ description: 'Total number of members', example: 25 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Last page number', example: 3 })
  last_page: number;
}

export class CompanyAccessSummaryDto {
  @ApiProperty({
    description: 'Company ID',
    example: 'cmp_cm3x7n8f70000vs6g5jkg5hkn',
  })
  company_id: string;

  @ApiProperty({ description: 'Total number of members', example: 25 })
  total_members: number;

  @ApiProperty({ description: 'Number of owners', example: 2 })
  owners: number;

  @ApiProperty({ description: 'Number of guests', example: 23 })
  guests: number;

  @ApiProperty({ description: 'Number of pending invitations', example: 3 })
  pending_invitations: number;

  @ApiProperty({ description: 'Number of banned members', example: 1 })
  banned_members: number;
}

export class UserCompanyDto {
  @ApiProperty({
    description: 'Access ID',
    example: 'luc_cm3x7n8f70000vs6g5jkg5hkn',
  })
  id: string;

  @ApiProperty({
    description: 'Company ID',
    example: 'cmp_cm3x7n8f70000vs6g5jkg5hkn',
  })
  company_id: string;

  @ApiProperty({ description: 'Access type', enum: link_user_company_type })
  type: link_user_company_type;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-12-23T10:00:00Z',
  })
  created_at: Date;

  @ApiProperty({ description: 'Company information' })
  company: {
    id: string;
    name: string;
    status: string;
  };
}

export class UserCompanyListResponseDto {
  @ApiProperty({
    description: 'List of user companies',
    type: [UserCompanyDto],
  })
  data: UserCompanyDto[];

  @ApiProperty({ description: 'Total number of companies', example: 5 })
  total: number;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;
}

export class MemberActionResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({
    description: 'Updated member information',
    type: CompanyMemberDto,
  })
  member: CompanyMemberDto;
}
