import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import type { Environment } from '../environment';
import type { LoginDto } from './dto/login.dto';
import type { AccessTokenPayload } from './auth.types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async login(input: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: input.email.toLowerCase(),
        status: 'ACTIVE',
        organization: { code: input.organizationCode.toLowerCase(), status: 'ACTIVE' },
      },
    });
    if (!user || !(await compare(input.password, user.passwordHash)))
      throw new UnauthorizedException('Invalid credentials');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user.id, user.organizationId);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const now = new Date();
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
      include: { user: { include: { organization: true } } },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.status !== 'ACTIVE' ||
      session.user.organization.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextRefreshToken = randomBytes(48).toString('base64url');
    const refreshDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.refreshSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          expiresAt: { gt: now },
          user: { status: 'ACTIVE', organization: { status: 'ACTIVE' } },
        },
        data: { revokedAt: now },
      });
      if (consumed.count !== 1) throw new UnauthorizedException('Invalid refresh token');

      await tx.refreshSession.create({
        data: {
          userId: session.user.id,
          tokenHash: this.hashToken(nextRefreshToken),
          expiresAt: new Date(now.getTime() + refreshDays * 86_400_000),
        },
      });
    });
    return this.signTokenPair(nextRefreshToken, session.user.id, session.user.organizationId);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, organizationId: string): Promise<TokenPair> {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshDays * 86_400_000),
      },
    });
    return this.signTokenPair(refreshToken, userId, organizationId);
  }

  private async signTokenPair(
    refreshToken: string,
    userId: string,
    organizationId: string,
  ): Promise<TokenPair> {
    const expiresIn = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const payload: AccessTokenPayload = { sub: userId, organizationId };
    return {
      accessToken: await this.jwt.signAsync(payload, { expiresIn }),
      refreshToken,
      expiresIn,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
