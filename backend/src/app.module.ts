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
import { FriendModule } from './friends/friend.module';
import { UserController } from './users/user.controller';
import { ScoreModule } from './scores';
import { ChatModule } from './chat/chat.module';
import { GamificationModule } from './gamification';
import { PresenceModule } from './presence/presence.module';
import { ProfileModule } from './profiles/profile.module';
import { TicTacToeModule } from './games/tictactoe/tictactoe.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    PresenceModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    EnvModule,
    DbModule,
    GameModule,
    RpsModule,
    TicTacToeModule,
    FriendModule,
    ScoreModule,
    ChatModule,
    GamificationModule,
    ProfileModule,
  ],
  controllers: [AppController, UserController],
  providers: [AppService],
})
export class AppModule {}
