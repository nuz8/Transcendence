import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import db from '../src/db/client';
import { users, friendships } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { WsAdapter } from '@nestjs/platform-ws';


describe('Friends (e2e)', () => {
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
			username: 'friends_e2e_alice',
			email: 'friends_e2e_alice@example.com',
			password: 'password123',
		});
		aliceId = aliceRegister.body.id;

		const bobRegister = await request(server).post('/auth/register').send({
			username: 'friends_e2e_bob',
			email: 'friends_e2e_bob@example.com',
			password: 'password123',
		});
		bobId = bobRegister.body.id;

		const aliceLogin = await request(server).post('/auth/login').send({
			email: 'friends_e2e_alice@example.com',
			password: 'password123',
		});
		aliceToken = aliceLogin.body.access_token;

		const bobLogin = await request(server).post('/auth/login').send({
			email: 'friends_e2e_bob@example.com',
			password: 'password123',
		});
		bobToken = bobLogin.body.access_token;
	});

	afterEach(async () => {
		await db.delete(friendships).where(eq(friendships.requesterId, aliceId));
		await db.delete(friendships).where(eq(friendships.requesterId, bobId));
	});

	afterAll(async () => {
		await db.delete(users).where(eq(users.email, 'friends_e2e_alice@example.com'));
		await db.delete(users).where(eq(users.email, 'friends_e2e_bob@example.com'));
		if (app) await app.close();
		await db.$client.end();
	});

	it('rejects requests without a token', async () => {
		await request(app.getHttpServer()).get('/friends').expect(401);
	});

	it('runs the full lifecycle: send, accept, list, remove', async () => {
		const server = app.getHttpServer();

		const sendRes = await request(server)
			.post('/friends')
			.set('Authorization', `Bearer ${aliceToken}`)
			.send({ addresseeId: bobId })
			.expect(201);

		expect(sendRes.body.status).toBe('pending');
		const friendshipId = sendRes.body.id;

		await request(server)
			.post(`/friends/${friendshipId}/accept`)
			.set('Authorization', `Bearer ${bobToken}`)
			.expect(200);

		const listRes = await request(server)
			.get('/friends')
			.set('Authorization', `Bearer ${aliceToken}`)
			.expect(200);

		expect(listRes.body.map((f: any) => f.friendshipId)).toContain(friendshipId);

		await request(server)
			.delete(`/friends/${friendshipId}`)
			.set('Authorization', `Bearer ${aliceToken}`)
			.expect(200);


		const listAfterRemove = await request(server)
			.get('/friends')
			.set('Authorization', `Bearer ${aliceToken}`)
			.expect(200);

		expect(listAfterRemove.body.map((f: any) => f.friendshipId)).not.toContain(friendshipId);
	});

	it('rejects sending a request with an invalid body', async () => {
		await request(app.getHttpServer())
			.post('/friends')
			.set('Authorization', `Bearer ${aliceToken}`)
			.send({ addresseeId: 'not-a-uuid' })
			.expect(400);
	});

	it('rejects a non-UUID friendship id with 400', async () => {
		await request(app.getHttpServer())
			.post('/friends/not-a-uuid/accept')
			.set('Authorization', `Bearer ${aliceToken}`)
			.expect(400);
	});

});
