import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Environment } from '../environment';
import { CurrentPrincipal, Public } from './auth.decorators';
import { AuthService, type TokenPair } from './auth.service';
import type { AuthenticatedPrincipal } from './auth.types';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE = 'wafi_refresh_token';

type AccessSession = Omit<TokenPair, 'refreshToken'>;

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Get('me')
  currentUser(@CurrentPrincipal() principal: AuthenticatedPrincipal): AuthenticatedPrincipal {
    return principal;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Access token; the refresh session is stored in a protected cookie.',
  })
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessSession> {
    const tokens = await this.authService.login(input);
    this.setRefreshCookie(response, tokens.refreshToken);
    return this.accessSession(tokens);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessSession> {
    const refreshToken = this.readRefreshCookie(request);
    if (!refreshToken) throw new UnauthorizedException('Invalid refresh token');
    const tokens = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(response, tokens.refreshToken);
    return this.accessSession(tokens);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = this.readRefreshCookie(request);
    if (refreshToken) await this.authService.logout(refreshToken);
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private accessSession(tokens: TokenPair): AccessSession {
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400_000,
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'strict' as const,
      path: '/api/v1/auth',
    };
  }

  private readRefreshCookie(request: Request): string | undefined {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${REFRESH_COOKIE}=`));
    if (!cookie) return undefined;
    try {
      return decodeURIComponent(cookie.slice(REFRESH_COOKIE.length + 1));
    } catch {
      return undefined;
    }
  }
}
