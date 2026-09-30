import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import db from '../src/db/client';
import { users, scores, userAchievements } from '../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { WsAdapter } from '@nestjs/platform-ws';
import { RPS_GAME_ID } from '../src/games/rps/rps.constants';
import { GamificationService } from '../src/gamification';
import { randomUUID } from 'node:crypto';

describe('Gamification (e2e)', () => {
  let app: INestApplication;
  let gamificationService: GamificationService;

  const testUserIds: string[] = [];
  let tokenAlpha: string;
  let tokenDelta: string;
  let userDeltaId: string;
  let userAlphaId: string;
  let userBetaId: string;

  const insertPvpWins = (userId: string, count: number, opponentId: string) =>
    db.insert(scores).values(
      Array.from({ length: count }, () => ({
        sessionId: randomUUID(),
        userId,
        opponentId,
        gameId: RPS_GAME_ID,
        value: 3,
        outcome: 'win' as const,
        achievedAt: new Date(),
      })),
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    gamificationService =
      moduleFixture.get<GamificationService>(GamificationService);

    // Register 5 distinct users for leaderboard and achievement testing
    const server = app.getHttpServer();

    // Helper to register user
    const registerUser = async (username: string, email: string) => {
      const regRes = await request(server)
        .post('/auth/register')
        .send({ username, email, password: 'Password123' })
        .expect(201);

      testUserIds.push(regRes.body.id);
      return regRes.body.id;
    };

    const loginUser = async (email: string) => {
      const res = await request(server)
        .post('/auth/login')
        .send({ email, password: 'Password123' })
        .expect(200);

      return res.body.access_token as string;
    };

    userAlphaId = await registerUser('gamif_alpha', 'gamif_alpha@example.com');
    userBetaId = await registerUser(
      'gamif_beta',
      'gamif_beta@example.com',
    );
    const userCharlieId = await registerUser(
      'gamif_charlie',
      'gamif_charlie@example.com',
    );
    userDeltaId = await registerUser('gamif_delta', 'gamif_delta@example.com');
    const userEchoId = await registerUser(
      'gamif_echo',
      'gamif_echo@example.com',
    );

    tokenAlpha = await loginUser('gamif_alpha@example.com');
    tokenDelta = await loginUser('gamif_delta@example.com');

    // Setup XPs directly in DB for testing leaderboard ordering and tie-breaking:
    // Alpha: 50 XP
    // Beta: 20 XP (username 'gamif_beta')
    // Charlie: 20 XP (username 'gamif_charlie') -> tied XP with Beta, should sort alphabetically!
    // Delta: 0 XP -> accounts at 0 XP included
    // Echo: 100 XP, but soft-deleted -> must be EXCLUDED from leaderboard!
    await db.update(users).set({ xp: 50 }).where(eq(users.id, userAlphaId));
    await db.update(users).set({ xp: 20 }).where(eq(users.id, userBetaId));
    await db.update(users).set({ xp: 20 }).where(eq(users.id, userCharlieId));
    await db.update(users).set({ xp: 0 }).where(eq(users.id, userDeltaId));
    await db
      .update(users)
      .set({ xp: 100, deletedAt: new Date() })
      .where(eq(users.id, userEchoId));
  });

  afterAll(async () => {
    if (testUserIds.length > 0) {
      // 1. Clean up scores
      await db.delete(scores).where(inArray(scores.userId, testUserIds));
      // 2. Clean up user_achievements
      await db
        .delete(userAchievements)
        .where(inArray(userAchievements.userId, testUserIds));
      // 3. Clean up users
      await db.delete(users).where(inArray(users.id, testUserIds));
    }

    if (app) {
      await app.close();
    }
    await db.$client.end();
  });

  describe('Authentication & Validation', () => {
    it('rejects unauthenticated requests to GET /leaderboard with 401', async () => {
      await request(app.getHttpServer()).get('/leaderboard').expect(401);
    });

    it('rejects unauthenticated requests to GET /users/self/achievements with 401', async () => {
      await request(app.getHttpServer())
        .get('/users/self/achievements')
        .expect(401);
    });

    it('rejects unauthenticated requests to GET /users/:id/achievements with 401', async () => {
      await request(app.getHttpServer())
        .get(`/users/${userDeltaId}/achievements`)
        .expect(401);
    });

    it('returns 400 when an invalid UUID is passed to GET /users/:id/achievements', async () => {
      await request(app.getHttpServer())
        .get('/users/not-a-valid-uuid/achievements')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .expect(400);
    });

    it('returns 404 when a valid UUID does not identify a user', async () => {
      await request(app.getHttpServer())
        .get(`/users/${randomUUID()}/achievements`)
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .expect(404);
    });

    it('validates query parameters for GET /leaderboard (e.g. limit > 100 or page < 1)', async () => {
      await request(app.getHttpServer())
        .get('/leaderboard?page=0')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/leaderboard?limit=101')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .expect(400);
    });
  });

  describe('Leaderboard Endpoint (GET /leaderboard)', () => {
    it('returns leaderboard ordered by XP DESC, then username ASC (alphabetical tie-breaker)', async () => {
      const res = await request(app.getHttpServer())
        .get('/leaderboard?page=1&limit=10')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);

      // Filter only our test users to verify their relative ordering
      const testItems = res.body.items.filter((item: any) =>
        [
          'gamif_alpha',
          'gamif_beta',
          'gamif_charlie',
          'gamif_delta',
          'gamif_echo',
        ].includes(item.username),
      );

      // 1. Soft-deleted user 'gamif_echo' MUST be excluded
      const echoFound = testItems.find((i: any) => i.username === 'gamif_echo');
      expect(echoFound).toBeUndefined();

      // 2. 0 XP account 'gamif_delta' MUST be included
      const deltaFound = testItems.find(
        (i: any) => i.username === 'gamif_delta',
      );
      expect(deltaFound).toBeDefined();
      expect(deltaFound.xp).toBe(0);
      expect(deltaFound.level).toBe(0);

      // 3. Check exact order among active test users:
      // Alpha (50 XP) > Beta (20 XP, 'b') > Charlie (20 XP, 'c') > Delta (0 XP)
      const usernames = testItems.map((i: any) => i.username);
      expect(usernames).toEqual([
        'gamif_alpha',
        'gamif_beta',
        'gamif_charlie',
        'gamif_delta',
      ]);

      // 4. Check each entry format
      const alphaEntry = testItems[0];
      expect(alphaEntry).toMatchObject({
        username: 'gamif_alpha',
        xp: 50,
        level: expect.any(Number),
        avatar: expect.any(String),
        rank: expect.any(Number),
      });
    });

    it('correctly pages results and computes global ranks across pages', async () => {
      // Query page 1 with limit 2
      const page1 = await request(app.getHttpServer())
        .get('/leaderboard?page=1&limit=2')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .expect(200);

      expect(page1.body.page).toBe(1);
      expect(page1.body.limit).toBe(2);
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.items[0].rank).toBe(1);
      expect(page1.body.items[1].rank).toBe(2);

      // Query page 2 with limit 2
      const page2 = await request(app.getHttpServer())
        .get('/leaderboard?page=2&limit=2')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .expect(200);

      expect(page2.body.page).toBe(2);
      expect(page2.body.limit).toBe(2);
      expect(page2.body.items).toHaveLength(2);
      expect(page2.body.items[0].rank).toBe(3);
      expect(page2.body.items[1].rank).toBe(4);
    });
  });

  describe('Achievements Progression & Endpoints', () => {
    it('initially shows all achievements locked and nextMilestoneWins at 1', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/self/achievements')
        .set('Authorization', `Bearer ${tokenDelta}`)
        .expect(200);

      expect(res.body.totalWins).toBe(0);
      expect(res.body.unlockedCount).toBe(0);
      expect(res.body.nextMilestoneWins).toBe(1);
      expect(res.body.achievements).toBeDefined();
      expect(res.body.achievements.length).toBeGreaterThanOrEqual(8);

      // Verify all are locked
      for (const a of res.body.achievements) {
        expect(a.unlocked).toBe(false);
        expect(a.unlockedAt).toBeNull();
        expect(a.badgeUrl).toMatch(/^\/static\/badges\/svg\/win-\d+\.svg$/);
      }
    });

    it('awards WIN_1 after the first PvP win without changing user XP', async () => {
      await insertPvpWins(userDeltaId, 1, userAlphaId);

      const result = await gamificationService.processPvpWin(userDeltaId);
      expect(result.map(({ id }) => id)).toEqual(['WIN_1']);

      const res = await request(app.getHttpServer())
        .get('/users/self/achievements')
        .set('Authorization', `Bearer ${tokenDelta}`)
        .expect(200);

      expect(res.body.totalWins).toBe(1);
      expect(res.body.unlockedCount).toBe(1);
      expect(res.body.nextMilestoneWins).toBe(2);

      const win1 = res.body.achievements.find((a: any) => a.id === 'WIN_1');
      expect(win1.unlocked).toBe(true);
      expect(win1.unlockedAt).not.toBeNull();

      const [user] = await db
        .select({ xp: users.xp })
        .from(users)
        .where(eq(users.id, userDeltaId));
      expect(user.xp).toBe(0);
    });

    it('does not count a loss toward PvP win milestones', async () => {
      await db.insert(scores).values({
        sessionId: randomUUID(),
        userId: userDeltaId,
        opponentId: userAlphaId,
        gameId: RPS_GAME_ID,
        value: 1,
        outcome: 'lose',
        achievedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/users/self/achievements')
        .set('Authorization', `Bearer ${tokenDelta}`)
        .expect(200);

      expect(res.body.totalWins).toBe(1);
      expect(res.body.unlockedCount).toBe(1);
    });

    it('awards WIN_2 upon reaching two PvP wins', async () => {
      await insertPvpWins(userDeltaId, 1, userAlphaId);
      const result = await gamificationService.processPvpWin(userDeltaId);

      expect(result.map(({ id }) => id)).toEqual(['WIN_2']);

      const res = await request(app.getHttpServer())
        .get('/users/self/achievements')
        .set('Authorization', `Bearer ${tokenDelta}`)
        .expect(200);

      expect(res.body.totalWins).toBe(2);
      expect(res.body.unlockedCount).toBe(2);
      expect(res.body.nextMilestoneWins).toBe(4); // Next power of 2 is 4
    });

    it('does not award an achievement at three wins', async () => {
      await insertPvpWins(userDeltaId, 1, userAlphaId);
      await expect(gamificationService.processPvpWin(userDeltaId)).resolves.toEqual([]);

      const res = await request(app.getHttpServer())
        .get('/users/self/achievements')
        .set('Authorization', `Bearer ${tokenDelta}`)
        .expect(200);

      expect(res.body.totalWins).toBe(3);
      expect(res.body.unlockedCount).toBe(2);
      expect(res.body.nextMilestoneWins).toBe(4);
    });

    it('awards WIN_4 upon reaching four PvP wins', async () => {
      await insertPvpWins(userDeltaId, 1, userAlphaId);
      const result = await gamificationService.processPvpWin(userDeltaId);

      expect(result.map(({ id }) => id)).toEqual(['WIN_4']);

      const res = await request(app.getHttpServer())
        .get('/users/self/achievements')
        .set('Authorization', `Bearer ${tokenDelta}`)
        .expect(200);

      expect(res.body.totalWins).toBe(4);
      expect(res.body.unlockedCount).toBe(3);
      expect(res.body.nextMilestoneWins).toBe(8); // Next power of 2 is 8
    });

    it('does not re-award achievement if called repeatedly (idempotency)', async () => {
      await expect(gamificationService.processPvpWin(userDeltaId)).resolves.toEqual([]);

      const userAchRows = await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, userDeltaId));

      // Must have exactly 3 unlocked achievements: WIN_1, WIN_2, WIN_4
      expect(userAchRows).toHaveLength(3);
    });

    it('ignores bot wins and awards all missing milestones when processing catches up', async () => {
      const originalBeta = await db
        .select({ xp: users.xp })
        .from(users)
        .where(eq(users.id, userBetaId));

      await db.insert(scores).values({
        sessionId: randomUUID(),
        userId: userAlphaId,
        opponentId: null,
        gameId: RPS_GAME_ID,
        value: 3,
        outcome: 'win',
        achievedAt: new Date(),
      });
      await expect(gamificationService.processPvpWin(userAlphaId)).resolves.toEqual([]);

      const alphaAchievements = await request(app.getHttpServer())
        .get('/users/self/achievements')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .expect(200);
      expect(alphaAchievements.body.totalWins).toBe(0);
      expect(alphaAchievements.body.unlockedCount).toBe(0);

      await insertPvpWins(userBetaId, 16, userAlphaId);
      const inserted = await gamificationService.processPvpWin(userBetaId);
      expect(inserted.map(({ id }) => id)).toEqual([
        'WIN_1',
        'WIN_2',
        'WIN_4',
        'WIN_8',
        'WIN_16',
      ]);

      const betaAchievements = await request(app.getHttpServer())
        .get(`/users/${userBetaId}/achievements`)
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .expect(200);
      expect(betaAchievements.body).toMatchObject({
        totalWins: 16,
        unlockedCount: 5,
        nextMilestoneWins: 32,
      });

      const [updatedBeta] = await db
        .select({ xp: users.xp })
        .from(users)
        .where(eq(users.id, userBetaId));
      expect(updatedBeta.xp).toBe(originalBeta[0].xp);
    });

    it('allows inspecting other player achievements via GET /users/:id/achievements', async () => {
      // User Alpha requests User Delta's achievements
      const res = await request(app.getHttpServer())
        .get(`/users/${userDeltaId}/achievements`)
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .expect(200);

      expect(res.body.totalWins).toBe(4);
      expect(res.body.unlockedCount).toBe(3);
      expect(res.body.nextMilestoneWins).toBe(8);
      expect(
        res.body.achievements.find((a: any) => a.id === 'WIN_4').unlocked,
      ).toBe(true);
    });
  });
});
