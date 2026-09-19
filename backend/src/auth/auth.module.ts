import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import type { StringValue } from "ms";
import { InMemoryUserRepository } from './test-utils/inMemoryUserRepository';
import { BcryptPasswordHasher } from './bcryptPasswordHasher';
import { AuthGuard } from './guards/auth.guard';
import { DenyList } from './denyList';
import { AllowList } from './allowList';


export const USER_REPOSITORY = 'USER_REPOSITORY';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<StringValue>('TOKEN_EXPIRATION_TIME', '600s') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: USER_REPOSITORY, useValue: new InMemoryUserRepository([]) },
    BcryptPasswordHasher,
    DenyList,
    AllowList,
    AuthGuard,
    {
      provide: AuthService,
      useFactory: (userRepo, hasher, jwtService, allowList) => new AuthService(userRepo, hasher, jwtService, allowList),
      inject: [USER_REPOSITORY, BcryptPasswordHasher, JwtService, AllowList],
    },
  ],
  exports: [AuthService, AuthGuard, DenyList, AllowList],
})
export class AuthModule {}
