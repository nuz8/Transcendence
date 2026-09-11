import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './users/user.module';
import { EnvModule } from './env/env.module';
import { validateEnv } from './env/env';
import { DbModule } from './db/db.module';
import { GameModule } from './games/game.module';
import { RpsModule } from './games/rps/rps.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    EnvModule,
    DbModule,
    GameModule,
    RpsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
