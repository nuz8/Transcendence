import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import db from '../src/db/client';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { WsAdapter } from '@nestjs/platform-ws';

describe('Auth Registration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    // Enable the exact same validation pipe as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  // Clean up any test user we insert
  afterEach(async () => {
    await db.delete(users).where(eq(users.email, 'e2e_test@example.com'));
    await db.delete(users).where(eq(users.email, 'first@example.com'));
    await db.delete(users).where(eq(users.email, 'second@example.com'));
    await db.delete(users).where(eq(users.email, 'race@example.com'));
  });

  afterAll(async () => {
    if (app) {
		  await app.close();
	  }
	  await db.$client.end();
  });

  it('POST /auth/register -> returns 201 and creates user in Postgres', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'e2e_user',
        email: 'e2e_test@example.com',
        password: 'password123',
      })
      .expect(201);

    // Verify response body
    expect(res.body.id).toBeDefined();
    expect(res.body.username).toBe('e2e_user');
    expect(res.body.email).toBe('e2e_test@example.com');
    expect(res.body.passwordHash).toBeUndefined();

    // Verify that created user actually exists in real PostgreSQL!
    const dbRows = await db
      .select()
      .from(users)
      .where(eq(users.email, 'e2e_test@example.com'));
    expect(dbRows.length).toBe(1);
    expect(dbRows[0].username).toBe('e2e_user');

	// Verify password is saved as a bcrypt hash, never plaintext
    expect(dbRows[0].passwordHash).not.toBe('password123');
    expect(dbRows[0].passwordHash.startsWith('$2b$')).toBe(true);
  });

  it('POST /auth/register -> rejects duplicate username with 409 Conflict', async () => {
    // Register first time
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'duplicate_user',
        email: 'first@example.com',
        password: 'password123',
      })
      .expect(201);

    // Register second time with duplicate username, different email
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'duplicate_user',
        email: 'second@example.com',
        password: 'password123',
      })
      .expect(409);

    expect(res.body.message).toBe('USERNAME_ALREADY_EXISTS');

    // Clean up extra email
    await db.delete(users).where(eq(users.email, 'first@example.com'));
  });

  it('POST /auth/register -> rejects duplicate email with 409 Conflict', async () => {
    // Register first time
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'user_one',
        email: 'e2e_test@example.com',
        password: 'password123',
      })
      .expect(201);

    // Register second time with duplicate email
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'user_two',
        email: 'e2e_test@example.com',
        password: 'password123',
      })
      .expect(409);

    expect(res.body.message).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('POST /auth/register -> rejects bad payload with 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: '',
        email: 'not-an-email',
        password: 'short',
      })
      .expect(400);

    expect(res.body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Username must not be empty'),
        expect.stringContaining('Email must be a valid email address'),
        expect.stringContaining('Password must be between 8 and 72 characters long'),
      ]),
    );
  });

it('POST /auth/register -> handles concurrent requests without 500 error', async () => {
  const payload = {
    username: 'race_user',
    email: 'race@example.com',
    password: 'password123',
  };

  // Fire 5 requests at the exact same time
  const responses = await Promise.all(
    Array.from({ length: 5 }).map(() =>
      request(app.getHttpServer()).post('/auth/register').send(payload),
    ),
  );

  const statuses = responses.map((r) => r.status);
  
  // Exactly 1 must be 201, and the other 4 MUST be 409 (NONE should be 500!)
  expect(statuses.filter((s) => s === 201).length).toBe(1);
  expect(statuses.filter((s) => s === 409).length).toBe(4);
  expect(statuses.filter((s) => s === 500).length).toBe(0);

  // To log the status codes and responses:
  // const statuses = responses.map((r) => r.status);
  // console.log('STATUSES RECEIVED:', statuses);
  // console.log('RESPONSES:', responses.map((r) => r.body));

  await db.delete(users).where(eq(users.email, 'race@example.com'));
});

});