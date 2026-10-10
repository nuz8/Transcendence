import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException, ConflictException, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Req } from '@nestjs/common';
import { DenyList } from './denyList';
import { AllowList } from './allowList';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import {
  ApiAuthController,
  ApiPostAuthLogin,
  ApiPostAuthRefresh,
  ApiPostAuthRegister,
  ApiPostAuthLogout,
} from './auth-api.decorators';
import { PublicUserResponseDto } from '../users/dto/public-user-response.dto';
import {
  LoginResponseDto,
  RefreshResponseDto,
  LogoutResponseDto,
} from './dto/auth-response.dto';

@ApiAuthController()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly denyList: DenyList,
    private readonly allowList: AllowList,
    private readonly jwtService: JwtService
  ) {}

  @Post('login')
  @ApiPostAuthLogin()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.authenticate(loginDto.email, loginDto.password);

    if (!result.success) {
      throw new UnauthorizedException(result.reason);
    }

    response.cookie(REFRESH_TOKEN_COOKIE.NAME, result.refresh_token, REFRESH_TOKEN_COOKIE.OPTIONS);

    return { user: result.user, access_token: result.access_token };
  }

  @Post('refresh')
  @ApiPostAuthRefresh()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE.NAME];
    const result = await this.authService.refresh(refreshToken);

    if (!result.success) {
      throw new UnauthorizedException(result.reason);
    }

    response.cookie(REFRESH_TOKEN_COOKIE.NAME, result.refresh_token, REFRESH_TOKEN_COOKIE.OPTIONS);

    return { access_token: result.access_token };
  }

  @Post('register')
  @ApiPostAuthRegister()
  async register(
    @Body() registerDto: RegisterDto
  ): Promise<PublicUserResponseDto> {
    const result = await this.authService.register(
      registerDto.username,
      registerDto.email,
      registerDto.password,
    );

    if (!result.success) {
      throw new ConflictException(result.reason);
    }

    return result.user;
  }

  @Post('logout')
  @ApiPostAuthLogout()
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResponseDto> {
    response.clearCookie(REFRESH_TOKEN_COOKIE.NAME, REFRESH_TOKEN_COOKIE.OPTIONS);
    await this.revokeAccessToken(request);

    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE.NAME];
    if (!refreshToken) {
      return { success: true };
    }

    let payload;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      return { success: true, refresh_token_revoked: false };
    }

    this.allowList.remove(payload.jti);
    return { success: true, refresh_token_revoked: true };
  }

  private async revokeAccessToken(request: Request): Promise<void> {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) return;

    try {
      const payload = await this.jwtService.verifyAsync<{ type: string; jti: string; exp: number }>(token);
      if (payload.type === 'access')
        this.denyList.revoke(payload.jti, payload.exp * 1000);
    } catch {
      return;
    }
  }
}
