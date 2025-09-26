import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { EmailService } from 'src/infrastructure/email/email.service';
import { v4 as uuidv4 } from 'uuid';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  JwtPayload,
  LoginDto,
  LoginResponse,
  RefreshTokenDto,
  ResetPasswordDto,
} from './auth.interfaces';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'secret';
    this.jwtExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '1h';
    this.jwtRefreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
        include: {
          links_user_companies: {
            where: {
              banned_at: null,
            },
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(dto.password, user.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (dto.company_id) {
        const hasAccess = user.links_user_companies.some(
          (link) => link.company_id === dto.company_id,
        );

        if (!hasAccess) {
          throw new UnauthorizedException(
            'You do not have access to this company',
          );
        }

        await this.updateLastAccessedCompany(user.id, dto.company_id);
      }

      const tokens = this.generateTokens(user.id, user.email);

      await this.saveRefreshToken(user.id, tokens.refresh_token);

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          companies: user.links_user_companies.map((link) => ({
            id: link.company.id,
            name: link.company.name,
            type: link.type,
          })),
        },
        expires_in: 3600, // 1 hora
      };
    } catch (error) {
      this.logger.error(`Login error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async refreshToken(dto: RefreshTokenDto): Promise<LoginResponse> {
    try {
      let payload: JwtPayload;

      try {
        payload = jwt.verify(dto.refresh_token, this.jwtSecret) as JwtPayload;
      } catch (error) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const savedToken = await this.prisma.user_refresh_token.findFirst({
        where: {
          user_id: payload.sub,
          token: dto.refresh_token,
          revoked: false,
          expires_at: {
            gt: new Date(),
          },
        },
      });

      if (!savedToken) {
        throw new UnauthorizedException('Refresh token not found or expired');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          links_user_companies: {
            where: {
              banned_at: null,
            },
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      await this.prisma.user_refresh_token.update({
        where: { id: savedToken.id },
        data: { revoked: true },
      });

      const tokens = this.generateTokens(user.id, user.email);

      await this.saveRefreshToken(user.id, tokens.refresh_token);

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          companies: user.links_user_companies.map((link) => ({
            id: link.company.id,
            name: link.company.name,
            type: link.type,
          })),
        },
        expires_in: 3600,
      };
    } catch (error) {
      this.logger.error(`Refresh token error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const isPasswordValid = await bcrypt.compare(
        dto.current_password,
        user.password,
      );

      if (!isPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      const hashedPassword = await bcrypt.hash(dto.new_password, 10);

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
        },
      });

      await this.prisma.user_refresh_token.updateMany({
        where: {
          user_id: userId,
          revoked: false,
        },
        data: {
          revoked: true,
        },
      });
    } catch (error) {
      this.logger.error(`Change password error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });

      if (!user) {
        return;
      }

      const resetToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);

      await this.prisma.user_password_reset_token.create({
        data: {
          user_id: user.id,
          token: resetToken,
          expires_at: expiresAt,
        },
      });

      // Envia email
      // await this.emailService.sendPasswordResetEmail({
      //   to: user.email,
      //   name: user.name,
      //   resetLink: `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`,
      // });
    } catch (error) {
      this.logger.error(`Forgot password error: ${error.message}`, error.stack);
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    try {
      const resetToken = await this.prisma.user_password_reset_token.findFirst({
        where: {
          token: dto.token,
          used: false,
          expires_at: {
            gt: new Date(),
          },
        },
      });

      if (!resetToken) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      const hashedPassword = await bcrypt.hash(dto.new_password, 10);

      await this.prisma.$transaction(async (tx) => {
        // Atualiza a senha
        await tx.user.update({
          where: { id: resetToken.user_id },
          data: {
            password: hashedPassword,
          },
        });

        await tx.user_password_reset_token.update({
          where: { id: resetToken.id },
          data: {
            used: true,
          },
        });

        await tx.user_refresh_token.updateMany({
          where: {
            user_id: resetToken.user_id,
            revoked: false,
          },
          data: {
            revoked: true,
          },
        });
      });
    } catch (error) {
      this.logger.error(`Reset password error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    try {
      if (refreshToken) {
        await this.prisma.user_refresh_token.updateMany({
          where: {
            user_id: userId,
            token: refreshToken,
          },
          data: {
            revoked: true,
          },
        });
      } else {
        await this.prisma.user_refresh_token.updateMany({
          where: {
            user_id: userId,
            revoked: false,
          },
          data: {
            revoked: true,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Logout error: ${error.message}`, error.stack);
      throw error;
    }
  }

  private generateTokens(userId: string, email: string) {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hora
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      email,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // 7 dias
    };

    const access_token = jwt.sign(accessPayload, this.jwtSecret);
    const refresh_token = jwt.sign(refreshPayload, this.jwtSecret);

    return {
      access_token,
      refresh_token,
    };
  }

  private async saveRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    await this.prisma.user_refresh_token.create({
      data: {
        user_id: userId,
        token,
        expires_at: expiresAt,
      },
    });
  }

  async updateLastAccessedCompany(
    userId: string,
    companyId: string,
  ): Promise<void> {
    this.logger.log(`User ${userId} accessed company ${companyId}`);
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      return jwt.verify(token, this.jwtSecret) as JwtPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
