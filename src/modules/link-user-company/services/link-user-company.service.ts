import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { UniqueIDGenerator } from 'src/common/utils/generate-unique-id.util';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { EmailService } from 'src/infrastructure/email/email.service';
import { CompanyService } from 'src/modules/company/services/company.service';
import { UserService } from 'src/modules/user/services/user.service';
import {
  AcceptInviteDto,
  InviteUserToCompanyDto,
  ListCompanyMembersQueryDto,
  UpdateUserPermissionsDto,
} from '../dto/link-user-company.dto';
import {
  CompanyAccessSummary,
  CompanyInvitation,
  CompanyMemberFilters,
  CompanyMemberListResponse,
  InvitationTokenPayload,
} from '../interfaces/link-user-company.interfaces';
import { LinkUserCompanyRepository } from '../repositories/link-user-company.repository';

@Injectable()
export class LinkUserCompanyService {
  private readonly logger = new Logger(LinkUserCompanyService.name);
  private readonly jwtSecret: string;
  private readonly invitationExpiryHours = 72; // 3 dias

  constructor(
    private readonly repository: LinkUserCompanyRepository,
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly companyService: CompanyService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'secret';
  }

  async inviteUser(
    companyId: string,
    invitedByUserId: string,
    dto: InviteUserToCompanyDto,
  ): Promise<{ message: string; invitation: CompanyInvitation }> {
    try {
      const isOwner = await this.repository.isOwner(invitedByUserId, companyId);

      if (!isOwner) {
        throw new ForbiddenException(
          'Only company owners can invite new members',
        );
      }

      const company = await this.companyService.findById(companyId);

      if (!company) {
        throw new NotFoundException('Company not found');
      }

      let user = await this.userService.findByEmail(dto.email);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user) {
        const existingLink = await this.repository.findByUserAndCompany(
          user.id,
          companyId,
        );

        if (existingLink) {
          if (existingLink.banned_at) {
            throw new ConflictException(
              'This user is banned from this company',
            );
          }
          throw new ConflictException(
            'User already has access to this company',
          );
        }
      }

      const invitationId = UniqueIDGenerator.generate();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.invitationExpiryHours);

      const tokenPayload: InvitationTokenPayload = {
        invitation_id: invitationId,
        company_id: companyId,
        email: dto.email,
        type: dto.type || 'GUEST',
        expires_at: expiresAt.getTime(),
      };

      const token = jwt.sign(tokenPayload, this.jwtSecret, {
        expiresIn: `${this.invitationExpiryHours}h`,
      });

      const invitation = await this.prisma.company_invitation.create({
        data: {
          id: invitationId,
          company_id: companyId,
          invited_email: dto.email.toLowerCase(),
          invited_by_user_id: invitedByUserId,
          token,
          type: dto.type || 'GUEST',
          status: 'PENDING',
          expires_at: expiresAt,
        },
      });

      // Enviar email de convite
      // await this.emailService.sendCompanyInvitation({
      //   to: dto.email,
      //   companyName: company.name,
      //   inviterName: invitedByUserId, // Você pode buscar o nome do usuário
      //   invitationLink: `${this.configService.get('FRONTEND_URL')}/accept-invite?token=${token}`,
      //   expiresIn: `${this.invitationExpiryHours} hours`,
      // });

      return {
        message: 'Invitation sent successfully',
        invitation: {
          id: invitationId,
          company_id: companyId,
          invited_email: dto.email.toLowerCase(),
          invited_by_user_id: invitedByUserId,
          token,
          type: dto.type || 'GUEST',
          status: 'PENDING',
          accepted_at: null,
          expires_at: expiresAt,
          created_at: new Date(),
          updated_at: new Date(),
          permissions: {
            read_payment: dto.read_payment || false,
            write_payment: dto.write_payment || false,
            read_withdrawal: dto.read_withdrawal || false,
            write_withdrawal: dto.write_withdrawal || false,
          },
        },
        // invitation: invitation as CompanyInvitation,
      };
    } catch (error) {
      this.logger.error(`Error inviting user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async acceptInvite(
    userId: string,
    dto: AcceptInviteDto,
  ): Promise<{ message: string }> {
    try {
      let tokenPayload: InvitationTokenPayload;

      try {
        tokenPayload = jwt.verify(
          dto.token,
          this.jwtSecret,
        ) as InvitationTokenPayload;
      } catch (error) {
        throw new UnauthorizedException('Invalid or expired invitation token');
      }

      if (Date.now() > tokenPayload.expires_at) {
        throw new BadRequestException('Invitation has expired');
      }

      const invitation = await this.prisma.company_invitation.findUnique({
        where: { id: tokenPayload.invitation_id },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      if (invitation.status !== 'PENDING') {
        throw new BadRequestException('Invitation has already been used');
      }

      const user = await this.userService.findById(userId);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.email.toLowerCase() !== invitation.invited_email.toLowerCase()) {
        throw new ForbiddenException(
          'This invitation was sent to a different email address',
        );
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.link_user_company.create({
          data: {
            user_id: userId,
            company_id: invitation.company_id,
            type: invitation.type,
          },
        });

        await tx.company_invitation.update({
          where: { id: invitation.id },
          data: {
            status: 'ACCEPTED',
            accepted_at: new Date(),
          },
        });
      });

      return {
        message: 'Invitation accepted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error accepting invitation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async listMembers(
    companyId: string,
    requestingUserId: string,
    query: ListCompanyMembersQueryDto,
  ): Promise<CompanyMemberListResponse> {
    try {
      const hasAccess = await this.repository.hasAccess(
        requestingUserId,
        companyId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this company');
      }

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const filters: CompanyMemberFilters = {
        type: query.type,
        include_banned: query.include_banned || false,
      };

      const { data, total } = await this.repository.findByCompanyId(
        companyId,
        filters,
        { skip, take: limit },
      );

      return {
        data,
        total,
        page,
        last_page: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(
        `Error listing company members: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateMemberPermissions(
    companyId: string,
    targetUserId: string,
    requestingUserId: string,
    dto: UpdateUserPermissionsDto,
  ) {
    try {
      const isOwner = await this.repository.isOwner(
        requestingUserId,
        companyId,
      );

      if (!isOwner) {
        throw new ForbiddenException(
          'Only company owners can update member permissions',
        );
      }

      if (requestingUserId === targetUserId) {
        const ownersCount = await this.repository.countByCompanyId(
          companyId,
          'OWNED',
        );

        if (ownersCount === 1 && dto.type === 'GUEST') {
          throw new BadRequestException(
            'Cannot change the last owner to guest',
          );
        }
      }

      // Tem q atualizar permissoes quando for implementada
      const type = dto.type || 'GUEST';

      console.log('targetUserId', targetUserId);
      console.log('companyId', companyId);

      const updated = await this.repository.updateByUserAndCompany(
        targetUserId,
        companyId,
        { type },
      );

      return {
        message: 'Permissions updated successfully',
        member: updated,
      };
    } catch (error) {
      this.logger.error(
        `Error updating member permissions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async removeMember(
    companyId: string,
    targetUserId: string,
    requestingUserId: string,
  ) {
    try {
      const isOwner = await this.repository.isOwner(
        requestingUserId,
        companyId,
      );

      if (!isOwner) {
        throw new ForbiddenException('Only company owners can remove members');
      }

      const targetMember = await this.repository.findByUserAndCompany(
        targetUserId,
        companyId,
      );

      if (!targetMember) {
        throw new NotFoundException('Member not found');
      }

      if (targetMember.type === 'OWNED') {
        const ownersCount = await this.repository.countByCompanyId(
          companyId,
          'OWNED',
        );

        if (ownersCount === 1) {
          throw new BadRequestException('Cannot remove the last owner');
        }
      }

      await this.repository.delete(targetUserId, companyId);

      return {
        message: 'Member removed successfully',
      };
    } catch (error) {
      this.logger.error(`Error removing member: ${error.message}`, error.stack);
      throw error;
    }
  }

  async banMember(
    companyId: string,
    targetUserId: string,
    requestingUserId: string,
  ) {
    try {
      const isOwner = await this.repository.isOwner(
        requestingUserId,
        companyId,
      );

      if (!isOwner) {
        throw new ForbiddenException('Only company owners can ban members');
      }

      if (requestingUserId === targetUserId) {
        throw new BadRequestException('Cannot ban yourself');
      }

      const targetMember = await this.repository.findByUserAndCompany(
        targetUserId,
        companyId,
      );

      if (!targetMember) {
        throw new NotFoundException('Member not found');
      }

      if (targetMember.type === 'OWNED') {
        throw new BadRequestException('Cannot ban another owner');
      }

      await this.repository.ban(targetUserId, companyId);

      return {
        message: 'Member banned successfully',
      };
    } catch (error) {
      this.logger.error(`Error banning member: ${error.message}`, error.stack);
      throw error;
    }
  }

  async unbanMember(
    companyId: string,
    targetUserId: string,
    requestingUserId: string,
  ) {
    try {
      const isOwner = await this.repository.isOwner(
        requestingUserId,
        companyId,
      );

      if (!isOwner) {
        throw new ForbiddenException('Only company owners can unban members');
      }

      await this.repository.unban(targetUserId, companyId);

      return {
        message: 'Member unbanned successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error unbanning member: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getAccessSummary(
    companyId: string,
    requestingUserId: string,
  ): Promise<CompanyAccessSummary> {
    try {
      const hasAccess = await this.repository.hasAccess(
        requestingUserId,
        companyId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this company');
      }

      const [total, owners, guests, banned, pendingInvitations] =
        await Promise.all([
          this.repository.countByCompanyId(companyId),
          this.repository.countByCompanyId(companyId, 'OWNED'),
          this.repository.countByCompanyId(companyId, 'GUEST'),
          this.prisma.link_user_company.count({
            where: {
              company_id: companyId,
              banned_at: { not: null },
            },
          }),
          this.prisma.company_invitation.count({
            where: {
              company_id: companyId,
              status: 'PENDING',
              expires_at: { gt: new Date() },
            },
          }),
        ]);

      return {
        company_id: companyId,
        total_members: total,
        owners,
        guests,
        pending_invitations: pendingInvitations,
        banned_members: banned,
      };
    } catch (error) {
      this.logger.error(
        `Error getting access summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getUserCompanies(userId: string) {
    try {
      const companies = await this.repository.findByUserId(userId);

      return {
        data: companies,
        total: companies.length,
      };
    } catch (error) {
      this.logger.error(
        `Error listing user companies: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
