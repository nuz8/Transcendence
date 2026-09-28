import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { DenyList } from './denyList';
import { AllowList } from './allowList';
import { JwtService } from '@nestjs/jwt';
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
    @Body() loginDto: LoginDto
  ): Promise<LoginResponseDto> {
    const result = await this.authService.authenticate(loginDto.email, loginDto.password);

    if (!result.success) {
      throw new UnauthorizedException(result.reason);
    }

    return { user: result.user, access_token: result.access_token, refresh_token: result.refresh_token };
  }

  @Post('refresh')
  @ApiPostAuthRefresh()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto
  ): Promise<RefreshResponseDto> {
    const result = await this.authService.refresh(refreshTokenDto.refresh_token);

    if (!result.success) {
      throw new UnauthorizedException(result.reason);
    }

    return { access_token: result.access_token, refresh_token: result.refresh_token };
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
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: any, @Body() logoutDto: LogoutDto
  ): Promise<LogoutResponseDto> {
    const expiresAt = req.user.exp * 1000;
    this.denyList.revoke(req.user.jti, expiresAt);

    if (!logoutDto?.refresh_token) {
      return { success: true };
    }

    let payload;
    try {
      payload = await this.jwtService.verifyAsync(logoutDto.refresh_token);
    } catch {
      return { success: true, refresh_token_revoked: false };
    }

    if (payload.sub !== req.user.sub) {
      return { success: true, refresh_token_revoked: false };
    }

    this.allowList.remove(payload.jti);
    return { success: true, refresh_token_revoked: true };
  }
}