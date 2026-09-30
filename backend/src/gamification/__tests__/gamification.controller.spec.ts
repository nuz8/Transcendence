import { Test, TestingModule } from '@nestjs/testing';
import { GamificationController } from '../gamification.controller';
import { GamificationService } from '../gamification.service';
import { AuthGuard } from '../../auth/guards/auth.guard';

describe('GamificationController', () => {
  let controller: GamificationController;
  let service: {
    getLeaderboard: jest.Mock;
    getUserAchievementsOverview: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getLeaderboard: jest.fn(),
      getUserAchievementsOverview: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamificationController],
      providers: [{ provide: GamificationService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GamificationController>(GamificationController);
  });

  it('delegates getLeaderboard to GamificationService', async () => {
    const expected = {
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      items: [],
    };
    service.getLeaderboard.mockResolvedValue(expected);

    const result = await controller.getLeaderboard({ page: 1, limit: 10 });
    expect(service.getLeaderboard).toHaveBeenCalledWith(1, 10);
    expect(result).toBe(expected);
  });

  it('delegates getSelfAchievements using req.user.sub', async () => {
    const expected = {
      totalWins: 2,
      unlockedCount: 2,
      nextMilestoneWins: 4,
      achievements: [],
    };
    service.getUserAchievementsOverview.mockResolvedValue(expected);

    const result = await controller.getSelfAchievements({
      user: { sub: 'self-user-id' },
    });
    expect(service.getUserAchievementsOverview).toHaveBeenCalledWith(
      'self-user-id',
    );
    expect(result).toBe(expected);
  });

  it('delegates getUserAchievements using param id', async () => {
    const expected = {
      totalWins: 0,
      unlockedCount: 0,
      nextMilestoneWins: 1,
      achievements: [],
    };
    service.getUserAchievementsOverview.mockResolvedValue(expected);

    const result = await controller.getUserAchievements('other-user-id');
    expect(service.getUserAchievementsOverview).toHaveBeenCalledWith(
      'other-user-id',
    );
    expect(result).toBe(expected);
  });
});
