import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './authService';
import { InMemoryUserRepository } from './test-utils/inMemoryUserRepository';
import { BcryptPasswordHasher } from './bcryptPasswordHasher';

export const USER_REPOSITORY = 'USER_REPOSITORY';


@Module({
  controllers: [AuthController],
  providers: [
    { provide: USER_REPOSITORY, useValue: new InMemoryUserRepository([]) },
    BcryptPasswordHasher,
    {
      provide: AuthService,
      useFactory: (userRepo, hasher) => new AuthService(userRepo, hasher),
      inject: [USER_REPOSITORY, BcryptPasswordHasher],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}