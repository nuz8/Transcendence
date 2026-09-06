import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EnvModule } from './env/env.module';
import { validateEnv } from './env/env';
import { RpsModule } from './games/rps/rps.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    EnvModule,
    RpsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
