import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { WsAdapter } from '@nestjs/platform-ws';
import { inArray, or, eq, asc, desc, isNull } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import db from '../src/db/client';
import { users, scores, friendships, games } from '../src/db/schema';
import { RPS_GAME_ID } from '../src/games/rps/rps.constants';

const NAMES = ['viewer', 'friend', 'outgoing', 'incoming', 'stranger', 'ghost', 'gamer'] as const;
type Name = (typeof NAMES)[number];

describe('User profile (e2e)', () => {
  let app: INestApplication;
  const ids = {} as Record<Name, string>;
  let token: string;

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const login = async (email: string) =>
    (await request(server()).post('/auth/login').send({ email, password: 'Password123' }).expect(200))
      .body.access_token as string;
  const loginAs = (name: Name) => login(`profile_e2e_${name}@example.com`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    for (const name of NAMES) {
      const res = await request(server())
        .post('/auth/register')
        .send({
          username: `profile_e2e_${name}`,
          email: `profile_e2e_${name}@example.com`,
          password: 'Password123',
        })
        .expect(201);
      ids[name] = res.body.id;
    }

    token = await loginAs('viewer');

    // viewer <-> friend: accepted
    const accepted = await request(server())
      .post('/friends')
      .set(auth())
      .send({ addresseeId: ids.friend })
      .expect(201);
    await request(server())
      .post(`/friends/${accepted.body.id}/accept`)
      .set({ Authorization: `Bearer ${await loginAs('friend')}` })
      .expect(200);

    // viewer -> outgoing: pending
    await request(server()).post('/friends').set(auth()).send({ addresseeId: ids.outgoing }).expect(201);

    // incoming -> viewer: pending
    await request(server())
      .post('/friends')
      .set({ Authorization: `Bearer ${await loginAs('incoming')}` })
      .send({ addresseeId: ids.viewer })
      .expect(201);

    await db.update(users).set({ xp: 30 }).where(eq(users.id, ids.friend));
    await db.update(users).set({ xp: 20 }).where(eq(users.id, ids.incoming));
    await db.update(users).set({ xp: 20 }).where(eq(users.id, ids.viewer));
    await db.update(users).set({ xp: 10 }).where(eq(users.id, ids.outgoing));
    await db.update(users).set({ xp: 0 }).where(eq(users.id, ids.stranger));
    await db
      .update(users)
      .set({ xp: 100, deletedAt: new Date() })
      .where(eq(users.id, ids.ghost));

    await db.insert(scores).values({
      sessionId: randomUUID(),
      userId: ids.friend,
      opponentId: ids.viewer,
      gameId: RPS_GAME_ID,
      value: 3,
      outcome: 'win',
      achievedAt: new Date(),
    });
  });

  afterAll(async () => {
    const all = Object.values(ids);
    await db.delete(scores).where(or(inArray(scores.userId, all), inArray(scores.opponentId, all)));
    await db
      .delete(friendships)
      .where(or(inArray(friendships.requesterId, all), inArray(friendships.addresseeId, all)));
    await db.delete(users).where(inArray(users.id, all));
    await app.close();
    await db.$client.end();
  });

  const getProfile = (id: string, query = '') =>
    request(server()).get(`/users/${id}/profile${query}`).set(auth());

  it('rejects with 401 without a token', async () => {
    await request(server()).get(`/users/${ids.friend}/profile`).expect(401);
  });

  it('rejects with 400 for a non-UUID id', async () => {
    await getProfile('not-a-uuid').expect(400);
  });

  it('rejects with 400 for an invalid page', async () => {
    await getProfile(ids.friend, '?page=0').expect(400);
  });

  it('returns 404 for an unknown user', async () => {
    await getProfile(randomUUID()).expect(404);
  });

  it('returns 404 for a soft-deleted user', async () => {
    await getProfile(ids.ghost).expect(404);
  });

  it('returns public user fields, with level derived from xp, and no private fields', async () => {
    const res = await getProfile(ids.friend).expect(200);

    expect(res.body).toMatchObject({
      id: ids.friend,
      username: 'profile_e2e_friend',
      xp: 30,
      level: 6,
    });
    expect(res.body.email).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('includes the achievements overview', async () => {
    const res = await getProfile(ids.friend).expect(200);

    expect(res.body.achievements.totalWins).toBe(1);
    expect(Array.isArray(res.body.achievements.achievements)).toBe(true);
  });

  describe('userStats', () => {
    it('includes overall and per-game stats of the requested user', async () => {
      const res = await getProfile(ids.friend).expect(200);

      expect(res.body.userStats).toEqual({
        played: 1,
        wins: 1,
        losses: 0,
        draws: 0,
        forfeits: 0,
        games: [
          {
            gameId: RPS_GAME_ID,
            gameName: expect.any(String),
            played: 1,
            wins: 1,
            losses: 0,
            draws: 0,
            forfeits: 0,
          },
        ],
      });
    });

    it('returns zeroed stats and no games for a user who has not played', async () => {
      const res = await getProfile(ids.stranger).expect(200);

      expect(res.body.userStats).toEqual({
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        forfeits: 0,
        games: [],
      });
    });

    it('is the same for any caller, regardless of friendship', async () => {
      const asViewer = await getProfile(ids.friend).expect(200);
      const asStranger = await request(server())
        .get(`/users/${ids.friend}/profile`)
        .set({ Authorization: `Bearer ${await loginAs('stranger')}` })
        .expect(200);

      expect(asStranger.body.userStats).toEqual(asViewer.body.userStats);
    });

    describe('with scores across multiple games', () => {
      const DICE_GAME_ID = randomUUID();
      const DICE_GAME_NAME = 'profile_e2e Dice Elimination';

      const score = (gameId: string, outcome: 'win' | 'lose' | 'draw' | 'forfeit') => ({
        sessionId: randomUUID(),
        userId: ids.gamer,
        opponentId: ids.stranger,
        gameId,
        value: null,
        outcome,
        achievedAt: new Date(),
      });

      beforeAll(async () => {
        await db.insert(games).values({ id: DICE_GAME_ID, name: DICE_GAME_NAME });
        await db.insert(scores).values([
          score(RPS_GAME_ID, 'win'),
          score(RPS_GAME_ID, 'win'),
          score(RPS_GAME_ID, 'lose'),
          score(RPS_GAME_ID, 'draw'),
          score(DICE_GAME_ID, 'win'),
          score(DICE_GAME_ID, 'lose'),
          score(DICE_GAME_ID, 'forfeit'),
        ]);
      });

      afterAll(async () => {
        await db.delete(scores).where(eq(scores.userId, ids.gamer));
        await db.delete(games).where(eq(games.id, DICE_GAME_ID));
      });

      it('returns one stats item per game, ordered by games played', async () => {
        const res = await getProfile(ids.gamer).expect(200);

        expect(res.body.userStats.games).toEqual([
          {
            gameId: RPS_GAME_ID,
            gameName: expect.any(String),
            played: 4,
            wins: 2,
            losses: 1,
            draws: 1,
            forfeits: 0,
          },
          {
            gameId: DICE_GAME_ID,
            gameName: DICE_GAME_NAME,
            played: 3,
            wins: 1,
            losses: 1,
            draws: 0,
            forfeits: 1,
          },
        ]);
      });

      it('totals the overall stats across all games', async () => {
        const res = await getProfile(ids.gamer).expect(200);

        expect(res.body.userStats).toMatchObject({
          played: 7,
          wins: 3,
          losses: 2,
          draws: 1,
          forfeits: 1,
        });
      });
    });
  });

  describe('matchHistory', () => {
    it('lists the matches of the requested user with their opponent', async () => {
      const res = await getProfile(ids.friend).expect(200);

      expect(res.body.matchHistory).toMatchObject({ total: 1, page: 1, limit: expect.any(Number) });
      expect(res.body.matchHistory.items).toHaveLength(1);
      expect(res.body.matchHistory.items[0]).toMatchObject({
        outcome: 'win',
        opponent: {
          id: ids.viewer,
          username: 'profile_e2e_viewer',
          avatar: 'api/static/avatars/default.svg',
          isDeleted: false,
        },
      });
    });

    it('returns the requested page and limit', async () => {
      const res = await getProfile(ids.friend, '?page=2&limit=1').expect(200);

      expect(res.body.matchHistory).toMatchObject({ total: 1, page: 2, limit: 1, items: [] });
    });

    it('returns a deleted-user placeholder for a soft-deleted opponent', async () => {
      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, ids.viewer));
      try {
        // viewer is now soft-deleted, so read the friend's profile with another caller
        const res = await request(server())
          .get(`/users/${ids.friend}/profile`)
          .set({ Authorization: `Bearer ${await loginAs('stranger')}` })
          .expect(200);

        expect(res.body.matchHistory.items[0].opponent).toEqual({
          id: ids.viewer,
          username: 'Deleted User',
          avatar: 'api/static/avatars/deleted.svg',
          isDeleted: true,
        });
      } finally {
        await db.update(users).set({ deletedAt: null }).where(eq(users.id, ids.viewer));
      }
    });

    it('returns a bot placeholder when the match has no opponent user', async () => {
      const sessionId = randomUUID();
      await db.insert(scores).values({
        sessionId,
        userId: ids.gamer,
        opponentId: null,
        gameId: RPS_GAME_ID,
        value: 1,
        outcome: 'lose',
        achievedAt: new Date(Date.now() + 1000),
      });

      try {
        const res = await getProfile(ids.gamer).expect(200);
        const botMatch = res.body.matchHistory.items.find(
          (item: { sessionId: string }) => item.sessionId === sessionId,
        );

        expect(botMatch).toBeDefined();
        expect(botMatch.opponent).toEqual({
          id: null,
          username: 'Bot',
          avatar: 'api/static/avatars/bot.svg',
          isDeleted: false,
        });
      } finally {
        await db.delete(scores).where(eq(scores.sessionId, sessionId));
      }
    });
  });

  it('reports friends with online status', async () => {
    const res = await getProfile(ids.friend).expect(200);

    expect(res.body.friendship.state).toBe('friends');
    expect(res.body.friendship.friendshipId).toEqual(expect.any(String));
    expect(res.body.online).toBe(false);
  });

  it.each([
    ['outgoing', 'pending_outgoing'],
    ['incoming', 'pending_incoming'],
    ['stranger', 'none'],
  ] as const)('reports %s as %s and hides online status', async (name, state) => {
    const res = await getProfile(ids[name]).expect(200);

    expect(res.body.friendship.state).toBe(state);
    expect(res.body.online).toBeUndefined();
  });

  it('reports self with online status', async () => {
    const res = await getProfile(ids.viewer).expect(200);

    expect(res.body.friendship).toEqual({ state: 'self', friendshipId: null });
    expect(res.body.online).toBe(false);
  });

  describe('GET /users/self/profile', () => {
    it('rejects with 401 without a token', async () => {
      await request(server()).get('/users/self/profile').expect(401);
    });

    it('rejects with 400 for an invalid page', async () => {
      await request(server()).get('/users/self/profile?page=0').set(auth()).expect(400);
    });

    it('returns the caller profile including email, matching the self relationship', async () => {
      const res = await request(server()).get('/users/self/profile').set(auth()).expect(200);

      expect(res.body).toMatchObject({
        id: ids.viewer,
        username: 'profile_e2e_viewer',
        email: 'profile_e2e_viewer@example.com',
        friendship: { state: 'self', friendshipId: null },
        online: false,
      });
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('includes the caller userStats', async () => {
      const res = await request(server()).get('/users/self/profile').set(auth()).expect(200);

      expect(res.body.userStats).toEqual({
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        forfeits: 0,
        games: [],
      });
    });

    it('matches the public profile for all fields except email', async () => {
      const self = await request(server()).get('/users/self/profile').set(auth()).expect(200);
      const byId = await getProfile(ids.viewer).expect(200);

      const { email, ...selfProfileWithoutEmail } = self.body;
      expect(email).toBe('profile_e2e_viewer@example.com');
      expect(byId.body.email).toBeUndefined();
      expect(selfProfileWithoutEmail).toEqual(byId.body);
    });

    it('returns 404 when the caller has been soft-deleted', async () => {
      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, ids.viewer));
      try {
        await request(server()).get('/users/self/profile').set(auth()).expect(404);
      } finally {
        await db.update(users).set({ deletedAt: null }).where(eq(users.id, ids.viewer));
      }
    });
  });

  it('returns the user position in the active-user leaderboard ordering', async () => {
    const activeUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(desc(users.xp), asc(users.username));

    const expectedRank = activeUsers.findIndex(({ id }) => id === ids.viewer) + 1;
    expect(expectedRank).toBeGreaterThan(0);
    expect(activeUsers.some(({ id }) => id === ids.ghost)).toBe(false);

    const res = await getProfile(ids.viewer).expect(200);
    expect(res.body.globalRank).toBe(expectedRank);
  });
});