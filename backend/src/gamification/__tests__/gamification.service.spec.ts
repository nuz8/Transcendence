import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from '../gamification.service';
import { NotFoundException } from '@nestjs/common';
import {
  GamificationRepository,
  UnlockedAchievement,
} from '../gamification.repository';
import { UserService } from '../../users';
import { INITIAL_ACHIEVEMENTS } from '../achievement-catalogue';

describe('GamificationService', () => {
  let service: GamificationService;
  let gamificationRepo: {
    countPvpWins: jest.Mock;
    findAchievementsThroughWins: jest.Mock;
    awardAchievements: jest.Mock;
    findAchievementsByUser: jest.Mock;
    findLeaderboardUsers: jest.Mock;
    countActiveUsers: jest.Mock;
  };
  let userService: {
    findById: jest.Mock;
  };

  beforeEach(async () => {
    gamificationRepo = {
      countPvpWins: jest.fn(),
      findAchievementsThroughWins: jest.fn(),
      awardAchievements: jest.fn(),
      findAchievementsByUser: jest.fn(),
      findLeaderboardUsers: jest.fn(),
      countActiveUsers: jest.fn(),
    };

    userService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: GamificationRepository, useValue: gamificationRepo },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
  });

  describe('processPvpWin', () => {
    const userId = 'user-uuid-1';

    const win1 = {
        id: 'WIN_1',
        title: 'First Blood',
        description: 'Win your first game',
        badgeUrl: '/static/badges/svg/win-1.svg',
        targetWins: 1,
    };
    const win2 = {
      id: 'WIN_2',
      title: 'Double Down',
      description: 'Win 2 games',
      badgeUrl: '/static/badges/svg/win-2.svg',
      targetWins: 2,
    };

    it('batch-awards only eligible achievements the player does not already have', async () => {
      const unlockedAt = new Date('2026-09-29T12:00:00Z');
      gamificationRepo.countPvpWins.mockResolvedValue(2);
      gamificationRepo.findAchievementsThroughWins.mockResolvedValue([win1, win2]);
      gamificationRepo.findAchievementsByUser.mockResolvedValue([
        { ...win1, unlockedAt },
      ]);
      gamificationRepo.awardAchievements.mockResolvedValue([
        { achievementId: 'WIN_2', unlockedAt },
      ]);

      await expect(service.processPvpWin(userId)).resolves.toEqual([
        { ...win2, unlockedAt },
      ]);

      expect(gamificationRepo.countPvpWins).toHaveBeenCalledWith(userId);
      expect(gamificationRepo.findAchievementsThroughWins).toHaveBeenCalledWith(2);
      expect(gamificationRepo.awardAchievements).toHaveBeenCalledTimes(1);
      expect(gamificationRepo.awardAchievements).toHaveBeenCalledWith(userId, ['WIN_2']);
    });

    it('returns an empty array and batches no IDs when there are no eligible milestones', async () => {
      gamificationRepo.countPvpWins.mockResolvedValue(0);
      gamificationRepo.findAchievementsThroughWins.mockResolvedValue([]);
      gamificationRepo.findAchievementsByUser.mockResolvedValue([]);
      gamificationRepo.awardAchievements.mockResolvedValue([]);

      await expect(service.processPvpWin(userId)).resolves.toEqual([]);

      expect(gamificationRepo.awardAchievements).toHaveBeenCalledWith(userId, []);
    });

    it('catches up multiple missing milestones with one batch write', async () => {
      const eligible = INITIAL_ACHIEVEMENTS.filter(({ targetWins }) => targetWins <= 16);
      const unlocked = eligible.filter(({ targetWins }) => targetWins === 1 || targetWins === 4);
      const inserted = eligible.filter(({ targetWins }) => targetWins !== 1 && targetWins !== 4);
      const unlockedAt = new Date('2026-09-29T12:00:00Z');

      gamificationRepo.countPvpWins.mockResolvedValue(16);
      gamificationRepo.findAchievementsThroughWins.mockResolvedValue(eligible);
      gamificationRepo.findAchievementsByUser.mockResolvedValue(
        unlocked.map((achievement) => ({ ...achievement, unlockedAt })),
      );
      gamificationRepo.awardAchievements.mockResolvedValue(
        inserted.map(({ id }) => ({ achievementId: id, unlockedAt })),
      );

      const result = await service.processPvpWin(userId);

      expect(gamificationRepo.awardAchievements).toHaveBeenCalledTimes(1);
      expect(gamificationRepo.awardAchievements).toHaveBeenCalledWith(
        userId,
        inserted.map(({ id }) => id),
      );
      expect(result.map(({ id }) => id)).toEqual(inserted.map(({ id }) => id));
    });

    it('returns only rows actually inserted when a concurrent call wins an insert race', async () => {
      const unlockedAt = new Date('2026-09-29T12:00:00Z');
      gamificationRepo.countPvpWins.mockResolvedValue(2);
      gamificationRepo.findAchievementsThroughWins.mockResolvedValue([win1, win2]);
      gamificationRepo.findAchievementsByUser.mockResolvedValue([]);
      gamificationRepo.awardAchievements.mockResolvedValue([
        { achievementId: 'WIN_1', unlockedAt },
      ]);

      await expect(service.processPvpWin(userId)).resolves.toEqual([
        { ...win1, unlockedAt },
      ]);
    });

  });

  describe('getLeaderboard', () => {
    it('returns properly formatted leaderboard with global ranks and computed levels', async () => {
      const mockUsers = [
        { id: 'u1', username: 'alice', avatar: 'a1.svg', xp: 50 },
        { id: 'u2', username: 'bob', avatar: 'a2.svg', xp: 20 },
      ];

      gamificationRepo.findLeaderboardUsers.mockResolvedValue(mockUsers);
      gamificationRepo.countActiveUsers.mockResolvedValue(5);

      const result = await service.getLeaderboard(1, 2);

      expect(gamificationRepo.findLeaderboardUsers).toHaveBeenCalledWith(2, 0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(3);
      expect(result.items).toHaveLength(2);

      expect(result.items[0]).toEqual({
        rank: 1,
        userId: 'u1',
        username: 'alice',
        avatar: 'a1.svg',
        xp: 50,
        level: service.getLevel(50),
      });

      expect(result.items[1]).toEqual({
        rank: 2,
        userId: 'u2',
        username: 'bob',
        avatar: 'a2.svg',
        xp: 20,
        level: service.getLevel(20),
      });
    });

    it('calculates ranks with page offset for subsequent pages', async () => {
      const mockUsers = [
        { id: 'u3', username: 'charlie', avatar: 'a3.svg', xp: 10 },
        { id: 'u4', username: 'david', avatar: 'a4.svg', xp: 0 },
      ];

      gamificationRepo.findLeaderboardUsers.mockResolvedValue(mockUsers);
      gamificationRepo.countActiveUsers.mockResolvedValue(4);

      const result = await service.getLeaderboard(2, 2);

      expect(gamificationRepo.findLeaderboardUsers).toHaveBeenCalledWith(2, 2);
      expect(result.items[0].rank).toBe(3); // (2 - 1) * 2 + 0 + 1 = 3
      expect(result.items[1].rank).toBe(4); // (2 - 1) * 2 + 1 + 1 = 4
    });
  });

  describe('getUserAchievementsOverview', () => {
    const userId = 'user-uuid-1';

    beforeEach(() => {
      userService.findById.mockResolvedValue({});
    });

    it('returns all achievements with correct unlocked state and next milestone', async () => {
      const unlockDate = new Date('2026-09-20T12:00:00Z');
      gamificationRepo.countPvpWins.mockResolvedValue(1);
      gamificationRepo.findAchievementsByUser.mockResolvedValue([
        {
          id: 'WIN_1',
          title: 'First Blood',
          description: 'Win your first game',
          badgeUrl: '/static/badges/svg/win-1.svg',
          targetWins: 1,
          unlockedAt: unlockDate,
        },
      ]);

      const result = await service.getUserAchievementsOverview(userId);

      expect(result.totalWins).toBe(1);
      expect(result.unlockedCount).toBe(1);
      expect(result.nextMilestoneWins).toBe(2); // Next is WIN_2
      expect(result.achievements).toHaveLength(INITIAL_ACHIEVEMENTS.length);

      const win1 = result.achievements.find((a) => a.id === 'WIN_1');
      expect(win1?.unlocked).toBe(true);
      expect(win1?.unlockedAt).toEqual(unlockDate);

      const win2 = result.achievements.find((a) => a.id === 'WIN_2');
      expect(win2?.unlocked).toBe(false);
      expect(win2?.unlockedAt).toBeNull();
    });

    it('sets nextMilestoneWins to 1 when no achievements have been unlocked', async () => {
      gamificationRepo.countPvpWins.mockResolvedValue(0);
      gamificationRepo.findAchievementsByUser.mockResolvedValue([]);

      const result = await service.getUserAchievementsOverview(userId);

      expect(result.totalWins).toBe(0);
      expect(result.unlockedCount).toBe(0);
      expect(result.nextMilestoneWins).toBe(1);
      expect(result.achievements.every((a) => !a.unlocked)).toBe(true);
    });

    it('sets nextMilestoneWins to null when all achievements are unlocked', async () => {
      gamificationRepo.countPvpWins.mockResolvedValue(256);
      const allUnlocked: UnlockedAchievement[] = INITIAL_ACHIEVEMENTS.map(
        (a) => ({
          ...a,
          unlockedAt: new Date(),
        }),
      );
      gamificationRepo.findAchievementsByUser.mockResolvedValue(allUnlocked);

      const result = await service.getUserAchievementsOverview(userId);

      expect(result.unlockedCount).toBe(INITIAL_ACHIEVEMENTS.length);
      expect(result.nextMilestoneWins).toBeNull();
    });

    it('throws NotFoundException when the user does not exist', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(service.getUserAchievementsOverview(userId)).rejects.toThrow(
        NotFoundException,
      );

      expect(gamificationRepo.countPvpWins).not.toHaveBeenCalled();
      expect(gamificationRepo.findAchievementsByUser).not.toHaveBeenCalled();
    });
  });
});
