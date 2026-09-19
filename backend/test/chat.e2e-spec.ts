import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import db from '../src/db/client';
import { users, friendships, messages } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { WsAdapter } from '@nestjs/platform-ws';

describe('Chat (e2e)', () => {
	let app: INestApplication;

	let aliceId: string;
	let bobId: string;
	let aliceToken: string;
	let bobToken: string;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		app.useWebSocketAdapter(new WsAdapter(app));

		app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
		await app.init();

		const server = app.getHttpServer();

		const aliceRegister = await request(server).post('/auth/register').send({
			username: 'chat_e2e_alice',
			email: 'chat_e2e_alice@example.com',
			password: 'password123',
		});
		aliceId = aliceRegister.body.id;

		const bobRegister = await request(server).post('/auth/register').send({
			username: 'chat_e2e_bob',
			email: 'chat_e2e_bob@example.com',
			password: 'password123',
		});
		bobId = bobRegister.body.id;

		const aliceLogin = await request(server).post('/auth/login').send({
			email: 'chat_e2e_alice@example.com',
			password: 'password123',
		});
		aliceToken = aliceLogin.body.access_token;

		const bobLogin = await request(server).post('/auth/login').send({
			email: 'chat_e2e_bob@example.com',
			password: 'password123',
		});
		bobToken = bobLogin.body.access_token;
	});

	afterEach(async () => {
		await db.delete(friendships).where(eq(friendships.requesterId, aliceId));
		await db.delete(friendships).where(eq(friendships.requesterId, bobId));
		await db.delete(messages).where(eq(messages.senderId, aliceId));
		await db.delete(messages).where(eq(messages.senderId, bobId));
	});

	afterAll(async () => {
		await db.delete(users).where(eq(users.email, 'chat_e2e_alice@example.com'));
		await db.delete(users).where(eq(users.email, 'chat_e2e_bob@example.com'));
		if (app) await app.close();
		await db.$client.end();
	});

	async function makeFriends(): Promise<void> {
		const server = app.getHttpServer();

		const sendRes = await request(server)
			.post('/friends')
			.set('Authorization', `Bearer ${aliceToken}`)
			.send({ addresseeId: bobId })
			.expect(201);

		await request(server)
			.post(`/friends/${sendRes.body.id}/accept`)
			.set('Authorization', `Bearer ${bobToken}`)
			.expect(200);
	}

	it('rejects requests without a token', async () => {
		await request(app.getHttpServer()).get(`/chat/${bobId}`).expect(401);
	});

	it('rejects a non-UUID peer id with 400', async () => {
		await request(app.getHttpServer())
			.get('/chat/not-a-uuid')
			.set('Authorization', `Bearer ${aliceToken}`)
			.expect(400);
	});

	it('rejects reading a conversation with someone who is not a friend', async () => {
		await request(app.getHttpServer())
			.get(`/chat/${bobId}`)
			.set('Authorization', `Bearer ${aliceToken}`)
			.expect(403);
	});

	it('returns the conversation history once the pair is friends', async () => {
		await makeFriends();
		await db.insert(messages).values({ senderId: aliceId, receiverId: bobId, content: 'hi bob' });
		await db.insert(messages).values({ senderId: bobId, receiverId: aliceId, content: 'hi alice' });

		const res = await request(app.getHttpServer())
			.get(`/chat/${bobId}`)
			.set('Authorization', `Bearer ${aliceToken}`)
			.expect(200);

		expect(res.body.map((m: any) => m.content)).toEqual(['hi bob', 'hi alice']);
	});
});
