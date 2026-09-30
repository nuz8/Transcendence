import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray, like } from 'drizzle-orm';
import request from 'supertest';
import { WebSocket } from 'ws';
import { AppModule } from '../src/app.module';
import { db } from '../src/db/client';
import { scores, users } from '../src/db/schema';

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
        const socket = new WebSocket(`ws://127.0.0.1:${port}/games/rps`, {
            headers: { Authorization: `Bearer ${token}` },
        });
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
        await db.delete(scores).where(inArray(scores.userId, [aliceId, bobId]));
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
        expect(toA.data.targetRounds).toBe(2);
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
        a.send('join', sessionId);
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
});