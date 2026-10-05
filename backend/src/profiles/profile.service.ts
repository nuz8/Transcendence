import { Injectable, NotFoundException } from "@nestjs/common";
import { UserProfileData, UserService } from "../users";
import { FriendService } from "../friends";
import { PresenceService } from "../presence";
import { GamificationService } from "../gamification";
import { ScoreService } from "../scores";
import { ProfileResponseDto, SelfProfileResponseDto } from "./dto/profile-response.dto";

@Injectable()
export class ProfileService {
  constructor(
    private readonly userService: UserService,
    private readonly friendService: FriendService,
    private readonly presenceService: PresenceService,
    private readonly gamificationService: GamificationService,
    private readonly scoreService: ScoreService,
  ) {}

  async getProfile(
    callerId: string,
    targetId: string,
    page: number,
    limit: number,
  ): Promise<ProfileResponseDto> {
    const user = await this.userService.findProfileById(targetId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.buildProfile(callerId, user, page, limit);
  }

  async getSelfProfile(
    userId: string,
    page: number,
    limit: number,
  ): Promise<SelfProfileResponseDto> {
    const user = await this.userService.findSelfProfileById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const profile = await this.buildProfile(userId, user, page, limit);
    return { ...profile, email: user.email };
  }

  async buildProfile(
    callerId: string,
    user: UserProfileData,
    page: number,
    limit: number,
  ): Promise<ProfileResponseDto> {
    const [globalRank, friendship, achievements, stats, history] = await Promise.all ([
      this.gamificationService.getGlobalRank(user.username, user.xp),
      this.friendService.getRelationship(callerId, user.id),
      this.gamificationService.getUserAchievementsOverview(user.id),
      this.scoreService.statsFor(user.id),
      this.scoreService.listForUser(user.id, page, limit),
    ]);
    const canSeePresence = friendship.state === 'friends' || friendship.state === 'self';
    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      xp: user.xp,
      level: this.gamificationService.getLevel(user.xp),
      globalRank,
      friendship,
      online: canSeePresence ? this.presenceService.isOnline(user.id) : undefined,
      achievements,
      userStats: stats,
      matchHistory: {
        total: history.total,
        page,
        limit,
        items: history.matches,
      },
    };
  }
}