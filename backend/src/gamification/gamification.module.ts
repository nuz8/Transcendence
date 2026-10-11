import { Module } from "@nestjs/common";
import { UserModule } from "../users/user.module";
import { GamificationService } from "./gamification.service";
import { GamificationRepository } from "./gamification.repository";
import { GamificationController } from "./gamification.controller";
import { AuthModule } from "../auth/auth.module";
import { ApiKeyModule } from "../api-keys";

@Module({
  imports: [UserModule, AuthModule, ApiKeyModule],
  controllers: [GamificationController],
  providers: [GamificationService, GamificationRepository],
  exports: [GamificationService, GamificationRepository],
})
export class GamificationModule {}