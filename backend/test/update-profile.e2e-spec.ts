import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import db from '../src/db/client';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { WsAdapter } from '@nestjs/platform-ws';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

interface AuthLoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    avatar: string;
  };
}

interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  avatar: string;
  passwordHash?: string;
}

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

describe('Update Profile (e2e) - PATCH /users/self', () => {
  let app: NestExpressApplication;

  const testEmails = [
    'profile_user1@example.com',
    'profile_user2@example.com',
    'profile_race1@example.com',
    'profile_race2@example.com',
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.useStaticAssets(join(process.cwd(), 'public'), {
      prefix: '/static/',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();
  });

  const cleanupTestUsers = async () => {
    for (const email of testEmails) {
      await db.delete(users).where(eq(users.email, email));
    }
  };

  beforeEach(async () => {
    await cleanupTestUsers();
  });

  afterEach(async () => {
    await cleanupTestUsers();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await db.$client.end();
  });

  const registerAndLogin = async (username: string, email: string) => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username,
        email,
        password: 'password123',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'password123',
      })
      .expect(200);

    const body = loginRes.body as AuthLoginResponse;
    return {
      accessToken: body.access_token,
      user: body.user,
    };
  };

  describe('Ticket requirement: Allow edits to username and return public profile', () => {
    it('successfully updates username and returns updated public data without passwordHash', async () => {
      const { accessToken } = await registerAndLogin(
        'profile_user1',
        'profile_user1@example.com',
      );

      const res = await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'new_profile_name' })
        .expect(200);

      const profile = res.body as UserProfileResponse;
      expect(profile.username).toBe('new_profile_name');
      expect(profile.email).toBe('profile_user1@example.com');
      expect(profile.passwordHash).toBeUndefined();
      expect(profile.avatar).toBeDefined();

      // Verify persisted state in DB
      const dbRows = await db
        .select()
        .from(users)
        .where(eq(users.email, 'profile_user1@example.com'));
      expect(dbRows[0].username).toBe('new_profile_name');
    });

    it('normalizes username by trimming whitespace and lowercasing', async () => {
      const { accessToken } = await registerAndLogin(
        'profile_user1',
        'profile_user1@example.com',
      );

      const res = await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: '   TrimmedName   ' })
        .expect(200);

      const profile = res.body as UserProfileResponse;
      expect(profile.username).toBe('trimmedname');
    });

    it('allows updating to own current username without triggering conflict', async () => {
      const { accessToken } = await registerAndLogin(
        'profile_user1',
        'profile_user1@example.com',
      );

      const res = await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'profile_user1' })
        .expect(200);

      const profile = res.body as UserProfileResponse;
      expect(profile.username).toBe('profile_user1');
    });
  });

  describe('Extra payload', () => {
    it('rejects payload with extra/unknown fields', async () => {
      const { accessToken } = await registerAndLogin(
        'profile_user1',
        'profile_user1@example.com',
      );

      await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'valid_name', unknownField: 'not_allowed' })
        .expect(400);
    });
  });

  describe('Ticket requirement: Username stay unique, 409 with clashing field', () => {
    it('returns 409 Conflict when attempting to use an existing username', async () => {
      await registerAndLogin('profile_user1', 'profile_user1@example.com');
      const { accessToken: token2 } = await registerAndLogin(
        'profile_user2',
        'profile_user2@example.com',
      );

      const res = await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${token2}`)
        .send({ username: 'profile_user1' })
        .expect(409);

      const err = res.body as ErrorResponse;
      expect(err.message).toBe('USERNAME_ALREADY_EXISTS');
    });
  });

  describe('Ticket requirement: Duplicate check survives two requests at once (concurrency)', () => {
    it('handles concurrent updates to the same username: exactly 1 succeeds (200) and 1 conflicts (409)', async () => {
      const { accessToken: token1 } = await registerAndLogin(
        'profile_race1',
        'profile_race1@example.com',
      );
      const { accessToken: token2 } = await registerAndLogin(
        'profile_race2',
        'profile_race2@example.com',
      );

      const targetUsername = 'claimed_winner';

      // Send 2 concurrent PATCH requests to claim targetUsername
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .patch('/users/self')
          .set('Authorization', `Bearer ${token1}`)
          .send({ username: targetUsername }),
        request(app.getHttpServer())
          .patch('/users/self')
          .set('Authorization', `Bearer ${token2}`)
          .send({ username: targetUsername }),
      ]);

      const statuses = [res1.status, res2.status];

      expect(statuses.filter((s) => s === 200).length).toBe(1);
      expect(statuses.filter((s) => s === 409).length).toBe(1);
      expect(statuses.filter((s) => s === 500).length).toBe(0);

      // Verify in DB: exactly one user owns targetUsername
      const dbRows = await db
        .select()
        .from(users)
        .where(eq(users.username, targetUsername));
      expect(dbRows.length).toBe(1);
    });
  });

  describe('Ticket requirement: Changing credentials should not log you out', () => {
    it('keeps existing JWT access token valid and working after username change', async () => {
      const { accessToken } = await registerAndLogin(
        'profile_user1',
        'profile_user1@example.com',
      );

      // 1. Change username
      await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'renamed_user1' })
        .expect(200);

      // 2. Make authenticated request with the SAME token
      const getSelfRes = await request(app.getHttpServer())
        .get('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const profile = getSelfRes.body as UserProfileResponse;
      expect(profile.username).toBe('renamed_user1');
      expect(profile.email).toBe('profile_user1@example.com');
    });
  });

  describe('PR Feature: Empty patch gives profile back rather than failing', () => {
    it('returns current profile when body is empty object {}', async () => {
      const { accessToken } = await registerAndLogin(
        'profile_user1',
        'profile_user1@example.com',
      );

      const res = await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(200);

      const profile = res.body as UserProfileResponse;
      expect(profile.username).toBe('profile_user1');
      expect(profile.email).toBe('profile_user1@example.com');
    });

    it('returns current profile when body is omitted entirely', async () => {
      const { accessToken } = await registerAndLogin(
        'profile_user1',
        'profile_user1@example.com',
      );

      const res = await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const profile = res.body as UserProfileResponse;
      expect(profile.username).toBe('profile_user1');
    });
  });

  describe('Validation & error handling', () => {
    it('rejects username shorter than 3 characters with 400', async () => {
      const { accessToken } = await registerAndLogin(
        'profile_user1',
        'profile_user1@example.com',
      );

      await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'ab' })
        .expect(400);
    });

    it('rejects username longer than 32 characters with 400', async () => {
      const { accessToken } = await registerAndLogin(
        'profile_user1',
        'profile_user1@example.com',
      );

      await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'a'.repeat(33) })
        .expect(400);
    });

    it('rejects null username with 400', async () => {
      const { accessToken } = await registerAndLogin(
        'profile_user1',
        'profile_user1@example.com',
      );

      await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: null })
        .expect(400);
    });

    it('rejects non-string username with 400', async () => {
      const { accessToken } = await registerAndLogin(
        'profile_user1',
        'profile_user1@example.com',
      );

      await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 12345 })
        .expect(400);
    });

    it('rejects unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .patch('/users/self')
        .send({ username: 'unauth_name' })
        .expect(401);
    });

    it('rejects invalid token with 401', async () => {
      await request(app.getHttpServer())
        .patch('/users/self')
        .set('Authorization', 'Bearer invalid.token.here')
        .send({ username: 'unauth_name' })
        .expect(401);
    });
  });
});
