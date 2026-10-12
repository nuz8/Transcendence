import { NotFoundException } from '@nestjs/common';
import { ProfileService } from '../profile.service';
import type { FriendshipRelationship } from '../../friends';

const CALLER = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const GAME_ID = '33333333-3333-4333-8333-333333333333';

const user = { id: TARGET, username: 'target', avatar: 'api/static/avatars/default.svg', xp: 30 };
const selfUser = { ...user, email: 'target@example.com' };
const level = 6;
const globalRank = 3;
const achievements = { totalWins: 4, unlockedCount: 2, nextMilestoneWins: 5, achievements: [] };
const userStats = {
  played: 7,
  wins: 4,
  losses: 2,
  draws: 1,
  forfeits: 0,
  games: [
    { gameId: GAME_ID, gameName: 'Rock Paper Scissors', played: 7, wins: 4, losses: 2, draws: 1, forfeits: 0 },
  ],
};
const matches = [{ sessionId: 'session-1' }, { sessionId: 'session-2' }];

function build(options: {
  user?: typeof user | null;
  selfUser?: typeof selfUser | null;
  relationship?: FriendshipRelationship;
} = {}) {
  const userService = {
    findProfileById: jest.fn().mockResolvedValue(options.user === undefined ? user : options.user),
    findSelfProfileById: jest
      .fn()
      .mockResolvedValue(options.selfUser === undefined ? selfUser : options.selfUser),
  };
  const friendService = {
    getRelationship: jest
      .fn()
      .mockResolvedValue(options.relationship ?? { state: 'none', friendshipId: null }),
  };
  const presenceService = { isOnline: jest.fn().mockReturnValue(true) };
  const gamificationService = {
    getUserAchievementsOverview: jest.fn().mockResolvedValue(achievements),
    getLevel: jest.fn().mockReturnValue(level),
    getGlobalRank: jest.fn().mockResolvedValue(globalRank),
  };
  const scoreService = {
    statsFor: jest.fn().mockResolvedValue(userStats),
    listForUser: jest.fn().mockResolvedValue({ matches, total: 12 }),
  };

  const service = new ProfileService(
    userService as never,
    friendService as never,
    presenceService as never,
    gamificationService as never,
    scoreService as never,
  );

  return { service, userService, friendService, presenceService, scoreService, gamificationService };
}

describe('ProfileService', () => {
  describe('getProfile', () => {
    it('throws NotFound and builds nothing when the user does not exist or is soft-deleted', async () => {
      const { service, friendService, scoreService } = build({ user: null });

      await expect(service.getProfile(CALLER, TARGET, 1, 10)).rejects.toBeInstanceOf(NotFoundException);
      expect(friendService.getRelationship).not.toHaveBeenCalled();
      expect(scoreService.statsFor).not.toHaveBeenCalled();
      expect(scoreService.listForUser).not.toHaveBeenCalled();
    });

    it('returns the public user fields without email', async () => {
      const { service, userService } = build();

      const profile = await service.getProfile(CALLER, TARGET, 1, 10);

      expect(userService.findProfileById).toHaveBeenCalledWith(TARGET);
      expect(userService.findSelfProfileById).not.toHaveBeenCalled();
      expect(profile).toMatchObject({
        id: TARGET,
        username: 'target',
        avatar: 'api/static/avatars/default.svg',
        xp: 30,
      });
      expect(profile).not.toHaveProperty('email');
    });

    it('derives the level from the user xp', async () => {
      const { service, gamificationService } = build();

      const profile = await service.getProfile(CALLER, TARGET, 1, 10);

      expect(gamificationService.getLevel).toHaveBeenCalledWith(30);
      expect(profile.level).toBe(level);
    });

    it('includes the user global rank', async () => {
      const { service, gamificationService } = build();

      const profile = await service.getProfile(CALLER, TARGET, 1, 10);

      expect(gamificationService.getGlobalRank).toHaveBeenCalledWith('target', 30);
      expect(profile.globalRank).toBe(globalRank);
    });

    it('includes the target achievements overview', async () => {
      const { service, gamificationService } = build();

      const profile = await service.getProfile(CALLER, TARGET, 1, 10);

      expect(gamificationService.getUserAchievementsOverview).toHaveBeenCalledWith(TARGET);
      expect(profile.achievements).toEqual(achievements);
    });

    describe('userStats', () => {
      it('includes the stats of the target, not the caller, with the per-game breakdown', async () => {
        const { service, scoreService } = build();

        const profile = await service.getProfile(CALLER, TARGET, 1, 10);

        expect(scoreService.statsFor).toHaveBeenCalledWith(TARGET);
        expect(scoreService.statsFor).not.toHaveBeenCalledWith(CALLER);
        expect(profile.userStats).toEqual(userStats);
      });

      it('returns empty stats as-is for a user with no games', async () => {
        const { service, scoreService } = build();
        const emptyStats = { played: 0, wins: 0, losses: 0, draws: 0, forfeits: 0, games: [] };
        scoreService.statsFor.mockResolvedValue(emptyStats);

        const profile = await service.getProfile(CALLER, TARGET, 1, 10);

        expect(profile.userStats).toEqual(emptyStats);
      });
    });

    describe('matchHistory', () => {
      it('passes pagination through to the score lookup', async () => {
        const { service, scoreService } = build();

        await service.getProfile(CALLER, TARGET, 2, 5);

        expect(scoreService.listForUser).toHaveBeenCalledWith(TARGET, 2, 5);
      });

      it('wraps the matches with the total and the requested page and limit', async () => {
        const { service } = build();

        const profile = await service.getProfile(CALLER, TARGET, 2, 5);

        expect(profile.matchHistory).toEqual({ total: 12, page: 2, limit: 5, items: matches });
      });
    });

    describe('friendship and presence', () => {
      it('includes the relationship between the caller and the target', async () => {
        const relationship = { state: 'friends', friendshipId: 'friendship-1' } as const;
        const { service, friendService } = build({ relationship });

        const profile = await service.getProfile(CALLER, TARGET, 1, 10);

        expect(friendService.getRelationship).toHaveBeenCalledWith(CALLER, TARGET);
        expect(profile.friendship).toEqual(relationship);
      });

      it.each(['none', 'pending_outgoing', 'pending_incoming'] as const)(
        'omits online status when the state is %s',
        async (state) => {
          const { service, presenceService } = build({ relationship: { state, friendshipId: null } });

          const profile = await service.getProfile(CALLER, TARGET, 1, 10);

          expect(profile.online).toBeUndefined();
          expect(presenceService.isOnline).not.toHaveBeenCalled();
        },
      );

      it.each(['friends', 'self'] as const)('includes online status when the state is %s', async (state) => {
        const { service, presenceService } = build({ relationship: { state, friendshipId: null } });

        const profile = await service.getProfile(CALLER, TARGET, 1, 10);

        expect(presenceService.isOnline).toHaveBeenCalledWith(TARGET);
        expect(profile.online).toBe(true);
      });
    });
  });

  describe('getSelfProfile', () => {
    it('throws NotFound and builds nothing when the caller does not exist or is soft-deleted', async () => {
      const { service, scoreService } = build({ selfUser: null });

      await expect(service.getSelfProfile(TARGET, 1, 10)).rejects.toBeInstanceOf(NotFoundException);
      expect(scoreService.statsFor).not.toHaveBeenCalled();
      expect(scoreService.listForUser).not.toHaveBeenCalled();
    });

    it('adds the caller email, using the email-bearing lookup', async () => {
      const { service, userService } = build();

      const profile = await service.getSelfProfile(TARGET, 1, 10);

      expect(userService.findSelfProfileById).toHaveBeenCalledWith(TARGET);
      expect(userService.findProfileById).not.toHaveBeenCalled();
      expect(profile.email).toBe('target@example.com');
    });

    it('resolves the relationship of the caller with themselves', async () => {
      const { service, friendService } = build({ relationship: { state: 'self', friendshipId: null } });

      const profile = await service.getSelfProfile(TARGET, 1, 10);

      expect(friendService.getRelationship).toHaveBeenCalledWith(TARGET, TARGET);
      expect(profile.friendship).toEqual({ state: 'self', friendshipId: null });
    });

    it('includes the caller user stats', async () => {
      const { service, scoreService } = build();

      const profile = await service.getSelfProfile(TARGET, 1, 10);

      expect(scoreService.statsFor).toHaveBeenCalledWith(TARGET);
      expect(profile.userStats).toEqual(userStats);
    });

    it('passes pagination through to match history', async () => {
      const { service, scoreService } = build();

      const profile = await service.getSelfProfile(TARGET, 3, 7);

      expect(scoreService.listForUser).toHaveBeenCalledWith(TARGET, 3, 7);
      expect(profile.matchHistory).toMatchObject({ page: 3, limit: 7 });
    });

    it('returns the same profile as getProfile apart from the email', async () => {
      const { service } = build({ relationship: { state: 'self', friendshipId: null } });

      const { email, ...selfProfile } = await service.getSelfProfile(TARGET, 1, 10);
      const publicProfile = await service.getProfile(TARGET, TARGET, 1, 10);

      expect(email).toBe('target@example.com');
      expect(selfProfile).toEqual(publicProfile);
    });
  });
});
