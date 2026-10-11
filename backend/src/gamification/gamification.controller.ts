import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/guards/auth.guard";
import { GamificationService, LeaderboardResponse, UserAchievementsResponse } from "./gamification.service";
import { LeaderboardQueryDto } from "./dto/leaderboard-query.dto";
import {
  ApiGamificationController,
  ApiGetLeaderboard,
  ApiGetSelfAchievements,
  ApiGetUserAchievements,
} from "./gamification-api.decorators";
import { LeaderboardResponseDto } from "./dto/leaderboard-response.dto";
import { UserAchievementsResponseDto } from "./dto/user-achievements-response.dto";
import { ApiKeyAccess, AuthOrApiKeyGuard, ApiKeyThrottlerGuard } from "../api-keys";

@ApiGamificationController()
@Controller()
@UseGuards(AuthOrApiKeyGuard, ApiKeyThrottlerGuard)
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('leaderboard')
  @ApiGetLeaderboard()
  @ApiKeyAccess()
  async getLeaderboard(
    @Query()
    query: LeaderboardQueryDto
  ): Promise<LeaderboardResponseDto> {
    return this.gamificationService.getLeaderboard(query.page, query.limit);
  }

  @Get('users/self/achievements')
  @ApiGetSelfAchievements()
  async getSelfAchievements(
    @Req()
    req: { user: { sub: string } }
  ): Promise<UserAchievementsResponseDto> {
    return this.gamificationService.getUserAchievementsOverview(req.user.sub);
  }

  @Get('users/:id/achievements')
  @ApiGetUserAchievements()
  async getUserAchievements(
    @Param('id', ParseUUIDPipe)
    id: string,
  ): Promise<UserAchievementsResponseDto> {
    return this.gamificationService.getUserAchievementsOverview(id);
  }
}