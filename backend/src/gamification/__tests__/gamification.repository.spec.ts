import type { DB } from '../../db';
import { GamificationRepository } from '../gamification.repository';
import { PgDialect } from 'drizzle-orm/pg-core';
import { userAchievements } from '../../db/schema';

describe('GamificationRepository', () => {
  describe('countPvpWins', () => {
    let repository: GamificationRepository;
    let select: jest.Mock;
    let where: jest.Mock;

    beforeEach(() => {
      where = jest.fn();
      const from = jest.fn().mockReturnValue({ where });
      select = jest.fn().mockReturnValue({ from });
      const db = { select } as unknown as DB;
      repository = new GamificationRepository(db);
    });

    it('counts wins for the user while excluding bot matches', async () => {
      where.mockResolvedValue([{ total: 4 }]);

      await expect(repository.countPvpWins('user-uuid')).resolves.toBe(4);

      expect(select).toHaveBeenCalledWith({ total: expect.anything() });
      const dialect = new PgDialect();
      const query = dialect.sqlToQuery(where.mock.calls[0][0]);
      expect(query.sql).toContain('"user_id" = $1');
      expect(query.sql).toContain('"outcome" = $2');
      expect(query.sql).toContain('"opponent_id" is not null');
      expect(query.params).toEqual(['user-uuid', 'win']);
    });

    it('returns zero when the aggregate count is zero', async () => {
      where.mockResolvedValue([{ total: 0 }]);

      await expect(repository.countPvpWins('user-uuid')).resolves.toBe(0);
    });
  });

  describe('awardAchievements', () => {
    it('does not issue an insert for an empty batch', async () => {
      const insert = jest.fn();
      const repository = new GamificationRepository({ insert } as unknown as DB);

      await expect(repository.awardAchievements('user-uuid', [])).resolves.toEqual([]);

      expect(insert).not.toHaveBeenCalled();
    });

    it('inserts all achievement IDs in one conflict-safe batch and returns inserted rows', async () => {
      const unlockedAt = new Date('2026-09-29T12:00:00Z');
      const returning = jest.fn().mockResolvedValue([
        { achievementId: 'WIN_1', unlockedAt },
        { achievementId: 'WIN_2', unlockedAt },
      ]);
      const onConflictDoNothing = jest.fn().mockReturnValue({ returning });
      const values = jest.fn().mockReturnValue({ onConflictDoNothing });
      const insert = jest.fn().mockReturnValue({ values });
      const repository = new GamificationRepository({ insert } as unknown as DB);

      await expect(
        repository.awardAchievements('user-uuid', ['WIN_1', 'WIN_2']),
      ).resolves.toEqual([
        { achievementId: 'WIN_1', unlockedAt },
        { achievementId: 'WIN_2', unlockedAt },
      ]);

      expect(insert).toHaveBeenCalledWith(userAchievements);
      expect(values).toHaveBeenCalledWith([
        { userId: 'user-uuid', achievementId: 'WIN_1' },
        { userId: 'user-uuid', achievementId: 'WIN_2' },
      ]);
      expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
      expect(returning).toHaveBeenCalledWith({
        achievementId: userAchievements.achievementId,
        unlockedAt: userAchievements.unlockedAt,
      });
    });
  });
});