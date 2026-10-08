import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray, like } from 'drizzle-orm';
import request from 'supertest';
import { WebSocket } from 'ws';
import { AppModule } from '../src/app.module';
import { db } from '../src/db/client';
import { scores, users, gameSettings } from '../src/db/schema';
import { RPS_GAME_ID } from '../src/games/rps/rps.constants';
import { RpsGateway } from '../src/games/rps/rps.gateway';

const SUITE_DOMAIN = '@pvp-suite.local';
const PASSWORD = 'password123';

type Message = { event: string; data: any };

type Conn = {
    socket: WebSocket;
    next: (event: string | string[], timeoutMs?: number) => Promise<Message>;
    maybe: (event: string, timeoutMs?: number) => Promise<Message | null>;
    quiet: (ms: number) => Promise<Message[]>;
    send: (event: string, data?: unknown) => void;
};

describe('Rps (e2e)', () => {
    let app: INestApplication;
    let port: number;
    let aliceId: string;
    let bobId: string;
    let aliceToken: string;
    let bobToken: string;
    const open: WebSocket[] = [];

    async function register(name: string): Promise<{ id: string; token: string }> {
        const server = app.getHttpServer();
        const created = await request(server).post('/auth/register').send({
            username: name,
            email: `${name}${SUITE_DOMAIN}`,
            password: PASSWORD,
        });
        const login = await request(server).post('/auth/login').send({
            email: `${name}${SUITE_DOMAIN}`,
            password: PASSWORD,
        });
        return { id: created.body.id, token: login.body.access_token };
    }

    async function connect(token: string): Promise<Conn> {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/games/rps`);
        open.push(socket);

        const queue: Message[] = [];
        socket.on('message', (raw) => queue.push(JSON.parse(raw.toString())));
        await new Promise<void>((resolve, reject) => {
            socket.once('open', () => resolve());
            socket.once('error', reject);
        });

        const next = async (event: string | string[], timeoutMs = 2000): Promise<Message> => {
            const wanted = Array.isArray(event) ? event : [event];
            const deadline = Date.now() + timeoutMs;
            for (;;) {
                const at = queue.findIndex((m) => wanted.includes(m.event));
                if (at !== -1)
                    return queue.splice(at, 1)[0];
                if (Date.now() > deadline)
                    throw new Error(`timed out waiting for ${wanted.join('|')}, saw [${queue.map((m) => m.event).join(', ')}]`);
                await new Promise((r) => setTimeout(r, 20));
            }
        };

        const quiet = async (ms: number): Promise<Message[]> => {
            await new Promise((r) => setTimeout(r, ms));
            return queue.splice(0, queue.length);
        };

        const maybe = async (event: string, timeoutMs = 200): Promise<Message | null> => {
            try {
                return await next(event, timeoutMs);
            } catch {
                return null;
            }
        };
        socket.send(JSON.stringify({ event: 'auth', data: { token } }));
        await next('authenticated');

        return { socket, next, maybe, quiet, send: (event, data) => socket.send(JSON.stringify({ event, data })) };
    }

    async function pair(): Promise<{ a: Conn; b: Conn; sessionId: string }> {
        const a = await connect(aliceToken);
        const b = await connect(bobToken);
        a.send('queue');
        await a.next('waiting');
        b.send('queue');
        const matched = await a.next('matched');
        await b.next('matched');
        return { a, b, sessionId: matched.data.sessionId };
    }

    /** Alice always beats Bob, so a round is one call. A finished match sends 'round' and then 'over'. */
    async function playRound(a: Conn, b: Conn): Promise<{ toA: Message; toB: Message }> {
        a.send('move', 'rock');
        await a.next('waiting');
        b.send('move', 'scissors');
        return { toA: await a.next('round'), toB: await b.next('round') };
    }

    type Settings = { target: number; mode: 'fixed-target-score' | 'fixed-rounds'; powerUps?: boolean };

    async function useSettings(userId: string, { target, mode, powerUps = false }: Settings): Promise<void> {
        await db.insert(gameSettings)
            .values({ userId, gameId: RPS_GAME_ID, target, mode, powerUps })
            .onConflictDoUpdate({ target: [gameSettings.userId, gameSettings.gameId], set: { target, mode, powerUps } });
    }

    async function xpOf(userId: string): Promise<number> {
        const [row] = await db.select({ xp: users.xp }).from(users).where(eq(users.id, userId));
        return row.xp;
    }

    /** The gateway sends 'over' without waiting for the write, so poll for it. */
    async function rowsOf(userId: string, expected = 1, timeoutMs = 2000) {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
            const rows = await db.select().from(scores).where(eq(scores.userId, userId));
            if (rows.length >= expected || Date.now() > deadline)
                return rows;
            await new Promise((r) => setTimeout(r, 25));
        }
    }

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useWebSocketAdapter(new WsAdapter(app));
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.listen(0);
        port = (app.getHttpServer().address() as { port: number }).port;

        const leftovers = await db.select({ id: users.id }).from(users).where(like(users.email, `%${SUITE_DOMAIN}`));
        if (leftovers.length) {
            await db.delete(scores).where(inArray(scores.userId, leftovers.map((u) => u.id)));
            await db.delete(gameSettings).where(inArray(gameSettings.userId, leftovers.map((u) => u.id)));
            await db.delete(users).where(like(users.email, `%${SUITE_DOMAIN}`));
        }

        const alice = await register('pvp_alice');
        const bob = await register('pvp_bob');
        aliceId = alice.id;
        aliceToken = alice.token;
        bobId = bob.id;
        bobToken = bob.token;
    });

    afterEach(async () => {
        for (const socket of open.splice(0, open.length))
            socket.close();

        const gateway = app.get(RpsGateway);
        gateway.onModuleDestroy();
        gateway.onModuleInit();
        await db.delete(scores).where(inArray(scores.userId, [aliceId, bobId]));
        await db.delete(gameSettings).where(inArray(gameSettings.userId, [aliceId, bobId]));
        await db.update(users).set({ xp: 0 }).where(inArray(users.id, [aliceId, bobId]));
    });

    afterAll(async () => {
        await db.delete(scores).where(inArray(scores.userId, [aliceId, bobId]));
        await db.delete(users).where(like(users.email, `%${SUITE_DOMAIN}`));
        await app.close();
        await db.$client.end();
    });

    it('pairs two queued players into one session', async () => {
        const a = await connect(aliceToken);
        const b = await connect(bobToken);

        a.send('queue');
        expect((await a.next('waiting')).data.message).toContain('waiting');

        b.send('queue');
        const toA = await a.next('matched');
        const toB = await b.next('matched');

        expect(toA.data.sessionId).toBe(toB.data.sessionId);
        expect(toA.data).toMatchObject({ mode: 'fixed-target-score', target: 2 });
    });

    it('refuses a second queue from the same socket, and a bot match while waiting', async () => {
        const a = await connect(aliceToken);

        a.send('queue');
        await a.next('waiting');

        a.send('queue');
        expect((await a.next('error')).data.message).toBe('already in queue');

        a.send('create');
        expect((await a.next('error')).data.message).toBe('already in queue');
    });

    it('refuses to pair a user with themselves', async () => {
        const a = await connect(aliceToken);
        const sameUser = await connect(aliceToken);

        a.send('queue');
        await a.next('waiting');

        sameUser.send('queue');
        expect((await sameUser.next('error')).data.message).toBe('already in queue');
    });

    it('refuses a second match for a user who is already in one, until it ends', async () => {
        const { a, b } = await pair();
        const otherTab = await connect(aliceToken);

        otherTab.send('queue');
        expect((await otherTab.next('error')).data.message).toBe('already in a session');
        otherTab.send('create');
        expect((await otherTab.next('error')).data.message).toBe('already in a session');

        a.send('quit');
        await a.next('over');
        await b.next('over');
        await rowsOf(aliceId);

        otherTab.send('queue');
        await otherTab.next('waiting');
    });

    it('lets the user rejoin their own match from a new tab while it is open', async () => {
        const { a, b, sessionId } = await pair();
        a.socket.close();
        await b.next('opponent_disconnected');

        const newTab = await connect(aliceToken);
        newTab.send('queue');
        const refused = await newTab.next('error');
        expect(refused.data).toMatchObject({ message: 'already in a session', sessionId });

        newTab.send('join', refused.data.sessionId);
        expect((await newTab.next('joined')).data).toMatchObject({ ownScore: 0, opScore: 0 });
    });

    it('lets a player leave the queue and start a match on the same connection', async () => {
        const a = await connect(aliceToken);
        a.send('queue');
        await a.next('waiting');

        a.send('leave-queue');
        await a.next('left queue');
        a.send('leave-queue');
        expect((await a.next('error')).data.message).toBe('not in a queue');

        const b = await connect(bobToken);
        b.send('queue');
        await b.next('waiting');
        expect(await a.quiet(100)).toEqual([]);

        a.send('create');
        await a.next('created');
    });

    it('tells a rejoining player they already moved, and keeps the move', async () => {
        const { a, b, sessionId } = await pair();
        a.send('move', 'rock');
        await a.next('waiting');
        a.socket.close();
        await b.next('opponent_disconnected');

        const back = await connect(aliceToken);
        back.send('join', sessionId);
        const joined = await back.next('joined');
        expect(joined.data.moved).toBe(true);
        expect(joined.data.roundTimeLeft).toBeGreaterThan(0);
        expect(joined.data.roundTimeLeft).toBeLessThanOrEqual(60_000);

        b.send('move', 'scissors');
        const round = await back.next('round');
        expect(round.data).toMatchObject({ ownMove: 'rock', outcome: 'win' });
        expect(round.data.roundTimeLeft).toBeGreaterThan(59_000);
        await b.next('round');

        back.send('move', 'rock');
        await back.next('waiting');
        b.send('move', 'scissors');
        expect((await b.next('round')).data.roundTimeLeft).toBeNull();
        await b.next('over');
    });

    it('starts the next round paused while a player is away', async () => {
        const { a, b, sessionId } = await pair();
        a.send('move', 'rock');
        await a.next('waiting');
        a.socket.close();
        await b.next('opponent_disconnected');

        b.send('move', 'scissors');
        expect((await b.next('round')).data.roundTimeLeft).toBe(60_000);
        await b.quiet(1000);

        const back = await connect(aliceToken);
        back.send('join', sessionId);
        const joined = await back.next('joined');
        expect(joined.data).toMatchObject({ ownScore: 1, opScore: 0, moved: false });
        expect(joined.data.roundTimeLeft).toBeGreaterThan(59_500);
    });

    it('plays a bot match without sending join', async () => {
        const a = await connect(aliceToken);

        a.send('create');
        const sessionId = (await a.next('created')).data.sessionId;
        await a.next('joined');
        a.send('join', sessionId);
        expect((await a.next('error')).data.message).toBe('session already joined');

        a.send('move', 'rock');
        await a.next('round');
    });

    it('answers a move or a quit outside a match with the same error', async () => {
        const a = await connect(aliceToken);

        a.send('move', 'rock');
        expect((await a.next('error')).data.message).toBe('not in a session');
        a.send('quit');
        expect((await a.next('error')).data.message).toBe('not in a session');
    });

    it('waits for both moves, then shows each player their own side', async () => {
        const { a, b } = await pair();

        a.send('move', 'rock');
        expect((await a.next('waiting')).data.message).toContain('opponent');
        expect(await b.quiet(100)).toEqual([]);

        a.send('move', 'paper');
        expect((await a.next('error')).data.message).toBe('already moved');

        b.send('move', 'scissors');
        const toA = await a.next('round');
        const toB = await b.next('round');

        expect(toA.data).toMatchObject({ ownMove: 'rock', opMove: 'scissors', outcome: 'win', ownScore: 1, opScore: 0 });
        expect(toB.data).toMatchObject({ ownMove: 'scissors', opMove: 'rock', outcome: 'lose', ownScore: 0, opScore: 1 });
    });

    it('records two rows and both players XP when a match ends', async () => {
        const { a, b, sessionId } = await pair();

        await playRound(a, b);
        await playRound(a, b);

        const toA = await a.next('over');
        const toB = await b.next('over');

        expect(toA.data).toMatchObject({ outcome: 'win', ownScore: 2, opScore: 0 });
        expect(toB.data).toMatchObject({ outcome: 'lose', ownScore: 0, opScore: 2 });

        const [aliceRow] = await rowsOf(aliceId);
        const [bobRow] = await rowsOf(bobId);

        expect(aliceRow).toMatchObject({ sessionId, opponentId: bobId, outcome: 'win', value: 2 });
        expect(bobRow).toMatchObject({ sessionId, opponentId: aliceId, outcome: 'lose', value: 0 });
        expect(await xpOf(aliceId)).toBe(10);
        expect(await xpOf(bobId)).toBe(2);
    });

    it('ends the match for both on a quit, and pays the quitter nothing', async () => {
        const { a, b } = await pair();

        await playRound(a, b);
        b.send('quit');

        expect((await a.next('over')).data.outcome).toBe('win');
        expect((await b.next('over')).data.outcome).toBe('forfeit');

        const [aliceRow] = await rowsOf(aliceId);
        const [bobRow] = await rowsOf(bobId);

        expect(aliceRow.outcome).toBe('win');
        expect(bobRow.outcome).toBe('forfeit');
        expect(await xpOf(aliceId)).toBe(10);
        expect(await xpOf(bobId)).toBe(0);
    });

    it('plays a bot match as before, with one row and no XP', async () => {
        const a = await connect(aliceToken);

        a.send('create');
        const sessionId = (await a.next('created')).data.sessionId;
        await a.next('joined');

        let over: Message | null = null;
        for (let round = 0; round < 20 && !over; round += 1) {
            a.send('move', 'rock');
            await a.next('round');
            over = await a.maybe('over');
        }
        expect(over).not.toBeNull();

        const rows = await rowsOf(aliceId);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ sessionId, opponentId: null });
        expect(await xpOf(aliceId)).toBe(0);
    });

    it("starts a bot match with the player's settings", async () => {
        await useSettings(aliceId, { target: 5, mode: 'fixed-rounds' });
        const a = await connect(aliceToken);

        a.send('create');
        await a.next('created');

        expect((await a.next('joined')).data).toMatchObject({ mode: 'fixed-rounds', target: 5, powerUps: false });
    });

    it('pairs only players on the same settings', async () => {
        await useSettings(aliceId, { target: 3, mode: 'fixed-rounds' });
        const a = await connect(aliceToken);
        const b = await connect(bobToken);

        a.send('queue');
        await a.next('waiting');
        b.send('queue');
        await b.next('waiting');

        expect(await a.quiet(200)).toEqual([]);
    });

    it('ends a fixed-rounds match drawn and pays 5 XP each', async () => {
        await useSettings(aliceId, { target: 2, mode: 'fixed-rounds' });
        await useSettings(bobId, { target: 2, mode: 'fixed-rounds' });
        const { a, b } = await pair();

        await playRound(a, b);
        a.send('move', 'rock');
        await a.next('waiting');
        b.send('move', 'paper');

        expect((await a.next('over')).data).toMatchObject({ outcome: 'draw', ownScore: 1, opScore: 1 });
        expect((await b.next('over')).data.outcome).toBe('draw');
        await rowsOf(aliceId);
        await rowsOf(bobId);
        expect(await xpOf(aliceId)).toBe(5);
        expect(await xpOf(bobId)).toBe(5);
    });

    it('scores a doubled win twice and ends the match on it', async () => {
        await useSettings(aliceId, { target: 2, mode: 'fixed-target-score', powerUps: true });
        await useSettings(bobId, { target: 2, mode: 'fixed-target-score', powerUps: true });
        const { a, b } = await pair();

        a.send('power-up', 'double');
        await a.next('powerup_accepted');
        expect(await b.quiet(100)).toEqual([]);

        const { toA, toB } = await playRound(a, b);
        expect(toA.data).toMatchObject({ ownPowerUp: 'double', opPowerUp: null, ownScore: 2, opScore: 0 });
        expect(toB.data).toMatchObject({ ownPowerUp: null, opPowerUp: 'double' });
        expect((await a.next('over')).data.outcome).toBe('win');
    });

    it('makes a round a draw with a shield, whoever wins it, once per player', async () => {
        await useSettings(aliceId, { target: 2, mode: 'fixed-target-score', powerUps: true });
        await useSettings(bobId, { target: 2, mode: 'fixed-target-score', powerUps: true });
        const { a, b } = await pair();

        b.send('power-up', 'shield');
        await b.next('powerup_accepted');
        const lost = await playRound(a, b);
        expect(lost.toB.data).toMatchObject({ ownPowerUp: 'shield', ownScore: 0, opScore: 0 });

        a.send('power-up', 'shield');
        await a.next('powerup_accepted');
        const won = await playRound(a, b);
        expect(won.toA.data).toMatchObject({ ownPowerUp: 'shield', ownScore: 0, opScore: 0 });

        b.send('power-up', 'shield');
        expect((await b.next('error')).data.message).toBe('power-up not available');
    });

    it('refuses power-ups when they are off', async () => {
        const { a } = await pair();

        a.send('power-up', 'shield');
        expect((await a.next('error')).data.message).toBe('power-ups not enabled');
    });

    it('pairs players whose levels are close', async () => {
        await db.update(users).set({ xp: 5 }).where(eq(users.id, bobId));
        await pair();
    });

    it('keeps players whose levels are far apart waiting', async () => {
        await db.update(users).set({ xp: 1000 }).where(eq(users.id, bobId));
        const a = await connect(aliceToken);
        const b = await connect(bobToken);

        a.send('queue');
        await a.next('waiting');
        b.send('queue');
        await b.next('waiting');

        expect(await a.quiet(200)).toEqual([]);
    });
});