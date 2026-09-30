import { Module } from "@nestjs/common";
import { UserModule } from "../users/user.module";
import { GamificationService } from "./gamification.service";
import { GamificationRepository } from "./gamification.repository";
import { GamificationController } from "./gamification.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [UserModule, AuthModule],
  controllers: [GamificationController],
  providers: [GamificationService, GamificationRepository],
  exports: [GamificationService, GamificationRepository],
})
export class GamificationModule {}