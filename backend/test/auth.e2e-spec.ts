import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import db from '../src/db/client';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { WsAdapter } from '@nestjs/platform-ws';
import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';


function extractCookie(res: request.Response): string {
  return res.headers['set-cookie'][0].split(';')[0];
}

describe('Auth Registration (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.useStaticAssets(join(process.cwd(), 'public'), {
      prefix: '/static/',
    });
    app.useWebSocketAdapter(new WsAdapter(app));
    // Enable the exact same validation pipe as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.use(cookieParser());
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
    expect(res.body.avatar).toBe('/static/avatars/default.svg');
    expect(res.body.passwordHash).toBeUndefined();

    // Verify that created user actually exists in real PostgreSQL!
    const dbRows = await db
      .select()
      .from(users)
      .where(eq(users.email, 'e2e_test@example.com'));
    expect(dbRows.length).toBe(1);
    expect(dbRows[0].username).toBe('e2e_user');
    expect(dbRows[0].avatar).toBe('/static/avatars/default.svg');

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

  it('GET /static/avatars/default.svg -> serves the default avatar', () => {
    return request(app.getHttpServer())
      .get('/static/avatars/default.svg')
      .expect(200)
      .expect('Content-Type', /image\/svg\+xml/);
  });

  describe('POST /auth/login, /auth/refresh, /auth/logout', () => {
    beforeAll(async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        username: 'auth_flow_user',
        email: 'auth_flow_e2e@example.com',
        password: 'password123',
      });
    });

    afterAll(async () => {
      await db.delete(users).where(eq(users.email, 'auth_flow_e2e@example.com'));
    });

    it('sets the refresh token as an httpOnly cookie, never in the body', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'auth_flow_e2e@example.com', password: 'password123' })
        .expect(200);

      expect(res.body.access_token).toEqual(expect.any(String));
      expect(res.body.refresh_token).toBeUndefined();

      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toContain('refresh_token=');
      expect(cookie).toContain('HttpOnly');
    });

    it('rejects /auth/refresh with no cookie', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('rotates the refresh token cookie on /auth/refresh', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'auth_flow_e2e@example.com', password: 'password123' })
        .expect(200);
      const firstCookie = extractCookie(loginRes);

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', firstCookie)
        .expect(200);

      expect(refreshRes.body.access_token).toEqual(expect.any(String));
      expect(refreshRes.body.refresh_token).toBeUndefined();
      expect(extractCookie(refreshRes)).not.toBe(firstCookie);
    });

    it('clears the cookie and revokes the refresh token on logout', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'auth_flow_e2e@example.com', password: 'password123' })
        .expect(200);
      const cookie = extractCookie(loginRes);
      const accessToken = loginRes.body.access_token;

      const logoutRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookie)
        .expect(200);

            expect(extractCookie(logoutRes)).toBe('refresh_token=');

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('logs out with an expired access token and still revokes the refresh token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'auth_flow_e2e@example.com', password: 'password123' })
        .expect(200);
      const cookie = extractCookie(loginRes);
      const expiredToken = new JwtService({ secret: process.env.JWT_SECRET }).sign({
        sub: loginRes.body.user.id,
        type: 'access',
        jti: 'expired-access-jti',
        exp: Math.floor(Date.now() / 1000) - 60,
      });

      const logoutRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`)
        .set('Cookie', cookie)
        .expect(200);

      expect(logoutRes.body.refresh_token_revoked).toBe(true);
      expect(extractCookie(logoutRes)).toBe('refresh_token=');

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('succeeds and clears the cookie even with no token at all', async () => {
      const logoutRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(200);

      expect(logoutRes.body).toEqual({ success: true });
      expect(extractCookie(logoutRes)).toBe('refresh_token=');
    });
  });

});
