import { Injectable, NotFoundException } from "@nestjs/common";
import { GamificationRepository, UnlockedAchievement } from "./gamification.repository";
import { UserService } from "../users/user.service";
import { INITIAL_ACHIEVEMENTS } from "./achievement-catalogue";
import { getLevelFromXp } from "./gamification.constants";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  xp: number;
  level: number;
};

export type LeaderboardResponse = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  items: LeaderboardEntry[];
};

export type UserAchievementsResponse = {
  totalWins: number;
  unlockedCount: number;
  nextMilestoneWins: number | null;
  achievements: {
    id: string;
    title: string;
    description: string;
    badgeUrl: string;
    targetWins: number;
    unlocked: boolean;
    unlockedAt: Date | null;
  }[];
};

@Injectable()
export class GamificationService {
  constructor(
    private readonly gamificationRepository: GamificationRepository,
    private readonly userService: UserService,
  ) {}

  /**
   * Processes the progression when any match finishes or forfeits:
   * 1. Gets the total number of wins, and then gets all eligible achievements
   * 2. Gets the user's current achievements, and filters out eligible achievements for pending ones
   * 3. Batch-awards the pending achievements in one go
  */
  async processPvpWin(
    userId: string,
  ): Promise<UnlockedAchievement[]> {
    const totalWins = await this
      .gamificationRepository.countPvpWins(userId);
    const eligible = await this
      .gamificationRepository
      .findAchievementsThroughWins(totalWins);

    const awarded = await this
      .gamificationRepository
      .findAchievementsByUser(userId);
    const awardedIds = new Set(awarded.map((achievement) => achievement.id));
    const pending = eligible.filter(
      (achievement) => !awardedIds.has(achievement.id),
    );

    const inserted = await this.gamificationRepository.awardAchievements(
      userId,
      pending.map((achievement) => achievement.id),
    );

    const pendingById = new Map(
      pending.map((achievement) => [achievement.id, achievement])
    );
    
    return inserted.map(
      ({ achievementId, unlockedAt }) => ({
        ...pendingById.get(achievementId)!,
        unlockedAt,
      })
    );
  }
  
  /**
   * Helper fn to derive level from any XP amount.
  */
  getLevel(xp: number): number {
    return getLevelFromXp(xp);
  }

  async getLeaderboard(
    page: number,
    limit: number
  ): Promise<LeaderboardResponse> {
    const offset = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.gamificationRepository.findLeaderboardUsers(limit, offset),
      this.gamificationRepository.countActiveUsers(),
    ]);

    const items: LeaderboardEntry[] = rows.map((user, index) => ({
      rank: offset + index + 1,
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      xp: user.xp,
      level: this.getLevel(user.xp),
    }));

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total/limit) || 1,
      items,
    };
  }

  async getUserAchievementsOverview(userId: string): Promise<UserAchievementsResponse> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    const [totalWins, unlockedList] = await Promise.all([
      this.gamificationRepository.countPvpWins(userId),
      this.gamificationRepository.findAchievementsByUser(userId),
    ]);

    const unlockedMap = new Map(unlockedList.map(
      (a) => [a.id, a.unlockedAt]
    ));

    const all = INITIAL_ACHIEVEMENTS.map((item) => {
      const unlockedAt = unlockedMap.get(item.id) ?? null;
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        badgeUrl: item.badgeUrl,
        targetWins: item.targetWins,
        unlocked: unlockedAt !== null,
        unlockedAt,
      };
    });

    // Next milestone is the smallest targetWins not yet achieved
    const nextMilestone = all.find((a) => !a.unlocked)?.targetWins ?? null;

    return {
      totalWins,
      unlockedCount: unlockedList.length,
      nextMilestoneWins: nextMilestone,
      achievements: all,
    };
  }

  async getGlobalRank(username: string, xp: number): Promise<number> {
    const usersAhead = await this
      .gamificationRepository.countActiveUsersAheadOf(
        username,
        xp,
      );
    return usersAhead + 1;
  }
}