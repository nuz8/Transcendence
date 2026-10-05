import { Injectable } from "@nestjs/common";
import { InjectDb, type DB } from "../db";
import { eq, and, desc, asc, isNull, isNotNull, count, lte, gt, lt, or } from 'drizzle-orm';
import { users, scores, achievements, userAchievements } from "../db/schema";

export type UnlockedAchievement = {
  id: string;
  title: string;
  description: string;
  badgeUrl: string;
  targetWins: number;
  unlockedAt: Date;
};

export type LeaderboardUserRow = {
  id: string;
  username: string;
  avatar: string;
  xp: number;
};

@Injectable()
export class GamificationRepository {
  constructor(@InjectDb() private readonly db: DB) {}

  /**
   * Count total wins across ALL games for a user.
   */
  async countPvpWins(userId: string): Promise<number> {
    const [row] = await this.db 
      .select({ total: count() })
      .from(scores)
      .where(
        and(
          eq(scores.userId, userId),
          eq(scores.outcome, 'win'),
          isNotNull(scores.opponentId),
        )
      );

    return row?.total ?? 0;
  }

  /**
   * Find all achievements that are have targetWins <= wins.
   */
  async findAchievementsThroughWins(wins: number) {
    return this.db
      .select()
      .from(achievements)
      .where(lte(achievements.targetWins, wins))
      .orderBy(asc(achievements.targetWins));
  }

  /**
   * Atomically unlock an achievement for a user.
   * Uses ON CONFLICT DO NOTHING so it can never be awarded twice.
   * Returns true if newly unlocked, false if already held.
   */
  async awardAchievements(
    userId: string,
    achievementIds: string[]
  ): Promise<{ achievementId: string; unlockedAt: Date }[]> {
    if (achievementIds.length === 0) {
      return [];
    }

    return this.db
      .insert(userAchievements)
      .values(
        achievementIds.map(
          (achievementId) => ({ userId, achievementId })
        )
      )
      .onConflictDoNothing()
      .returning({
        achievementId: userAchievements.achievementId,
        unlockedAt: userAchievements.unlockedAt,
      });
  }

  /**
   * Get all unlocked achievements for a user, ordered by most recently unlocked.
   */
  async findAchievementsByUser(userId: string): Promise<UnlockedAchievement[]> {
    const rows = await this.db
      .select({
        id: achievements.id,
        title: achievements.title,
        description: achievements.description,
        badgeUrl: achievements.badgeUrl,
        targetWins: achievements.targetWins,
        unlockedAt: userAchievements.unlockedAt,
      })
      .from(userAchievements)
      .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(eq(userAchievements.userId, userId))
      .orderBy(desc(userAchievements.unlockedAt));

    return rows;
  }

  /**
   * Fetch a page of active users sorted globally by XP (descending), then username (ascending).
   * Accounts at 0 XP are included.
   */
  async findLeaderboardUsers(
    limit: number,
    offset: number
  ): Promise<LeaderboardUserRow[]> {
    return this.db
      .select({
        id: users.id,
        username: users.username,
        avatar: users.avatar,
        xp: users.xp
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(desc(users.xp), asc(users.username))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Method to count total number of active (non-deleted) users (for total pages calculation).
   */
  async countActiveUsers(): Promise<number> {
    const [rows] = await this.db
      .select({ total: count() })
      .from(users)
      .where(isNull(users.deletedAt));

    return rows?.total ?? 0;
  }

  /**
   * Method to count the active (non-deleted) users ahead of the target user
   */
  async countActiveUsersAheadOf(username: string, xp: number): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(
            gt(users.xp, xp),
            and(eq(users.xp, xp), lt(users.username, username)),
          ),
        ),
      );
    return row?.total ?? 0;
  }
}
