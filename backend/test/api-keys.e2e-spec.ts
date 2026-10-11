import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray, like, or } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { db } from '../src/db/client';
import { friendships, gameSettings, users } from '../src/db/schema';
import { RPS_GAME_ID } from '../src/games/rps/rps.constants';

const SUITE_DOMAIN = '@apikeys-suite.local';
const PASSWORD = 'password123';

describe('API keys (e2e)', () => {
    let app: INestApplication;
    let aliceId: string;
    let bobId: string;
    let aliceToken: string;
    let bobToken: string;

    const server = () => app.getHttpServer();
    const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

    async function register(name: string): Promise<{ id: string; token: string }> {
        const created = await request(server()).post('/auth/register').send({
            username: name,
            email: `${name}${SUITE_DOMAIN}`,
            password: PASSWORD,
        });
        const login = await request(server()).post('/auth/login').send({
            email: `${name}${SUITE_DOMAIN}`,
            password: PASSWORD,
        });
        return { id: created.body.id, token: login.body.access_token };
    }

    async function newKey(token = aliceToken): Promise<{ id: string; key: string; prefix: string }> {
        const res = await request(server()).post('/users/self/api-keys').set(bearer(token)).expect(201);
        return res.body;
    }

    async function removeSuiteUsers(): Promise<void> {
        const suite = await db.select({ id: users.id }).from(users).where(like(users.email, `%${SUITE_DOMAIN}`));
        if (!suite.length)
            return ;
        const ids = suite.map((u) => u.id);
        await db.delete(friendships).where(or(inArray(friendships.requesterId, ids), inArray(friendships.addresseeId, ids)));
        await db.delete(gameSettings).where(inArray(gameSettings.userId, ids));
        await db.delete(users).where(like(users.email, `%${SUITE_DOMAIN}`));
    }

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = moduleFixture.createNestApplication();
        app.useWebSocketAdapter(new WsAdapter(app));
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();

        await removeSuiteUsers();
        const alice = await register('apikeys_alice');
        const bob = await register('apikeys_bob');
        aliceId = alice.id;
        aliceToken = alice.token;
        bobId = bob.id;
        bobToken = bob.token;
    });

    afterAll(async () => {
        await removeSuiteUsers();
        await app.close();
        await db.$client.end();
    });

    it('turns away a request with neither a login token nor a key', async () => {
        await request(server()).get('/leaderboard').expect(401);
    });

    it('creates a key once, lists it without the secret, and revokes it', async () => {
        const created = await newKey();
        expect(created.key).toMatch(/^tk_[A-Za-z0-9_-]{43}$/);

        const list = await request(server()).get('/users/self/api-keys').set(bearer(aliceToken)).expect(200);
        expect(list.body.map((k: { id: string }) => k.id)).toContain(created.id);
        expect(JSON.stringify(list.body)).not.toContain(created.key);

        await request(server()).delete(`/users/self/api-keys/${created.id}`).set(bearer(bobToken)).expect(404);
        await request(server()).delete(`/users/self/api-keys/${created.id}`).set(bearer(aliceToken)).expect(204);
        await request(server()).get('/leaderboard').set('X-API-Key', created.key).expect(401);
    });

    it('lets a key use all five public routes, with the four verbs', async () => {
        const { key } = await newKey();
        const asKey = { 'X-API-Key': key };

        const board = await request(server()).get('/leaderboard?limit=3').set(asKey).expect(200);
        expect(Array.isArray(board.body.items)).toBe(true);

        const profile = await request(server()).get(`/users/${bobId}/profile`).set(asKey).expect(200);
        expect(profile.body.id).toBe(bobId);

        const settings = { target: 5, mode: 'fixed-rounds', theme: 'default', powerUps: false };
        const saved = await request(server()).put(`/users/self/games/${RPS_GAME_ID}/settings`).set(asKey).send(settings).expect(200);
        expect(saved.body).toMatchObject(settings);

        const sent = await request(server()).post('/friends').set(asKey).send({ addresseeId: bobId }).expect(201);
        expect(sent.body.requesterId).toBe(aliceId);
        await request(server()).post(`/friends/${sent.body.id}/accept`).set(bearer(bobToken)).expect(200);

        await request(server()).delete(`/friends/${sent.body.id}`).set(asKey).expect(200);
    });

    it('refuses a key on routes that do not accept one', async () => {
        const { key } = await newKey();
        const asKey = { 'X-API-Key': key };

        await request(server()).get('/users/self').set(asKey).expect(401);
        await request(server()).get('/friends').set(asKey).expect(401);
        await request(server()).post('/users/self/api-keys').set(asKey).expect(401);
    });

    it('refuses a made-up key, even beside a valid login token', async () => {
        await request(server()).get('/leaderboard').set('X-API-Key', 'tk_not-a-real-key').expect(401);
        await request(server()).get('/leaderboard').set(bearer(aliceToken)).set('X-API-Key', 'tk_not-a-real-key').expect(401);
    });

    it('refuses the key of a deleted user', async () => {
        const { key } = await newKey(bobToken);
        await request(server()).get('/leaderboard').set('X-API-Key', key).expect(200);

        await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, bobId));
        try {
            await request(server()).get('/leaderboard').set('X-API-Key', key).expect(401);
        } finally {
            await db.update(users).set({ deletedAt: null }).where(eq(users.id, bobId));
        }
    });

    it('allows five keys per user and refuses the sixth', async () => {
        const existing = await request(server()).get('/users/self/api-keys').set(bearer(aliceToken)).expect(200);
        for (let i = existing.body.length; i < 5; i += 1)
            await newKey();

        const sixth = await request(server()).post('/users/self/api-keys').set(bearer(aliceToken)).expect(409);
        expect(sixth.body.message).toBe('API_KEY_LIMIT_REACHED');
    });

    it('answers 429 with Retry-After after 60 requests with one key, without affecting other keys or the login token', async () => {
        const list = await request(server()).get('/users/self/api-keys').set(bearer(bobToken)).expect(200);
        for (const k of list.body)
            await request(server()).delete(`/users/self/api-keys/${k.id}`).set(bearer(bobToken));
        const { key } = await newKey(bobToken);

        for (let i = 0; i < 60; i += 1)
            await request(server()).get('/leaderboard?limit=1').set('X-API-Key', key).expect(200);
        const limited = await request(server()).get('/leaderboard?limit=1').set('X-API-Key', key).expect(429);
        expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);

        const otherKey = await newKey(bobToken);
        await request(server()).get('/leaderboard?limit=1').set('X-API-Key', otherKey.key).expect(200);


        await request(server()).get('/leaderboard?limit=1').set(bearer(bobToken)).expect(200);
    });
});
