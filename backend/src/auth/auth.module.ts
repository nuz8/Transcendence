import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import type { StringValue } from "ms";
import { InMemoryUserRepository } from './test-utils/inMemoryUserRepository';
import { BcryptPasswordHasher } from './bcryptPasswordHasher';
import { AuthGuard } from './guards/auth.guard';

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
    AuthGuard,
    {
      provide: AuthService,
      useFactory: (userRepo, hasher, jwtService) => new AuthService(userRepo, hasher, jwtService),
      inject: [USER_REPOSITORY, BcryptPasswordHasher, JwtService],
    },
  ],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
