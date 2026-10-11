import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../users/user.module";
import { FriendModule } from "../friends/friend.module";
import { PresenceModule } from "../presence/presence.module";
import { GamificationModule } from "../gamification/gamification.module";
import { ScoreModule } from "../scores/score.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";
import { ApiKeyModule } from "../api-keys";

@Module({
  imports: [
    AuthModule,
    UserModule,
    FriendModule,
    PresenceModule,
    GamificationModule,
    ScoreModule,
    ApiKeyModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}