import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import type { StringValue } from "ms";
import { BcryptPasswordHasher } from './bcryptPasswordHasher';
import { AuthGuard } from './guards/auth.guard';
import { UserModule } from '../users';
import { DenyList } from './denyList';
import { AllowList } from './allowList';
import { SocketAuthRegistry } from './socketAuthRegistry';

@Module({
  imports: [
    UserModule,
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
    BcryptPasswordHasher,
    DenyList,
    AllowList,
    SocketAuthRegistry,
    AuthGuard,
    AuthService,
  ],
  exports: [AuthService, AuthGuard, DenyList, AllowList, SocketAuthRegistry],
})
export class AuthModule {}
