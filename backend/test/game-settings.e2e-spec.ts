import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray, like } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { db } from '../src/db/client';
import { gameSettings, users } from '../src/db/schema';
import { RPS_GAME_ID } from '../src/games/rps/rps.constants';

const SUITE_DOMAIN = '@settings-suite.local';

describe('Game settings (e2e)', () => {
    let app: INestApplication;
    let userId: string;
    let token: string;

    const get = (gameId: string, auth = true) => {
        const req = request(app.getHttpServer()).get(`/users/self/games/${gameId}/settings`);
        return auth ? req.set('Authorization', `Bearer ${token}`) : req;
    };

    const put = (gameId: string, body: unknown, auth = true) => {
        const req = request(app.getHttpServer()).put(`/users/self/games/${gameId}/settings`);
        return (auth ? req.set('Authorization', `Bearer ${token}`) : req).send(body as object);
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = moduleFixture.createNestApplication();
        app.useWebSocketAdapter(new WsAdapter(app));
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();

        const leftovers = await db.select({ id: users.id }).from(users).where(like(users.email, `%${SUITE_DOMAIN}`));
        if (leftovers.length) {
            await db.delete(gameSettings).where(inArray(gameSettings.userId, leftovers.map((u) => u.id)));
            await db.delete(users).where(like(users.email, `%${SUITE_DOMAIN}`));
        }

        const server = app.getHttpServer();
        const registered = await request(server).post('/auth/register')
            .send({ username: 'settings_alice', email: `settings_alice${SUITE_DOMAIN}`, password: 'password123' });
        userId = registered.body.id;
        const login = await request(server).post('/auth/login')
            .send({ email: `settings_alice${SUITE_DOMAIN}`, password: 'password123' });
        token = login.body.access_token;
    });

    afterAll(async () => {
        await db.delete(gameSettings).where(eq(gameSettings.userId, userId));
        await db.delete(users).where(like(users.email, `%${SUITE_DOMAIN}`));
        await app.close();
        await db.$client.end();
    });

    it('rejects a request without a token', async () => {
        await put(RPS_GAME_ID, { target: 5, mode: 'fixed-target-score', theme: 'default', powerUps: false }, false).expect(401);
        await get(RPS_GAME_ID, false).expect(401);
    });

    it('gives the defaults before anything is saved, and 404 for a game that does not exist', async () => {
        const res = await get(RPS_GAME_ID).expect(200);
        expect(res.body).toEqual({ gameId: RPS_GAME_ID, target: 2, mode: 'fixed-target-score', theme: 'default', powerUps: false });

        await get('00000000-0000-4000-8000-000000000000').expect(404);
    });

    it('rejects a game id that is not a uuid', async () => {
        await put('not-a-uuid', { target: 5, mode: 'fixed-target-score', theme: 'default', powerUps: false }).expect(400);
    });

    it('rejects targets outside 1 to 10, unknown modes and themes, a non-boolean powerUps, and a missing field', async () => {
        const ok = { target: 5, mode: 'fixed-rounds', theme: 'default', powerUps: false };
        const { target, mode, theme, powerUps, ...none } = ok;
        const bodies = [
            { ...ok, target: 0 }, { ...ok, target: 11 }, { ...ok, target: 2.5 }, { ...ok, target: '5' },
            { ...ok, mode: 'first-to' }, { ...ok, theme: 'pink' }, { ...ok, powerUps: 'yes' },
            { mode, theme, powerUps }, { target, theme, powerUps }, { target, mode, powerUps }, { target, mode, theme }, none,
            { ...ok, extra: 1 },
        ];
        for (const body of bodies)
            await put(RPS_GAME_ID, body).expect(400);
    });

    it('answers 404 for a game that does not exist', async () => {
        await put('00000000-0000-4000-8000-000000000000', { target: 5, mode: 'fixed-target-score', theme: 'default', powerUps: false }).expect(404);
    });

    it('saves the setting and replaces it on a second put', async () => {
        const first = await put(RPS_GAME_ID, { target: 4, mode: 'fixed-rounds', theme: 'extra', powerUps: true }).expect(200);
        expect(first.body).toEqual({ gameId: RPS_GAME_ID, target: 4, mode: 'fixed-rounds', theme: 'extra', powerUps: true });

        await put(RPS_GAME_ID, { target: 7, mode: 'fixed-target-score', theme: 'default', powerUps: false }).expect(200);

        const rows = await db.select().from(gameSettings).where(eq(gameSettings.userId, userId));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ target: 7, mode: 'fixed-target-score', theme: 'default', powerUps: false });
        expect((await get(RPS_GAME_ID).expect(200)).body).toEqual({ gameId: RPS_GAME_ID, target: 7, mode: 'fixed-target-score', theme: 'default', powerUps: false });
    });
});

