import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import db from '../src/db/client';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { WsAdapter } from '@nestjs/platform-ws';
import { NestExpressApplication } from '@nestjs/platform-express';
import { promises as fs } from 'node:fs';
import { basename, join } from 'node:path';
import { AVATAR_CONSTANTS } from '../src/users/user.constants';


describe('Users Self (e2e)', () => {
  let app: NestExpressApplication;
  const uploadedAvatarPaths: string[] = [];

  const pngFile = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000000020001e221bc330000000049454e44ae426082',
    'hex',
  );

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

  afterEach(async () => {
    await db.delete(users).where(eq(users.email, 'users_self_e2e@example.com'));

    await Promise.all(
      uploadedAvatarPaths.splice(0).map((filePath) =>
        fs.rm(filePath, { force: true }),
      ),
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await db.$client.end();
  });

  const registerAndLogin = async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'users_self_e2e',
        email: 'users_self_e2e@example.com',
        password: 'password123',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'users_self_e2e@example.com',
        password: 'password123',
      })
      .expect(200);

    return loginRes.body.access_token as string;
  };

  it('GET /users/self -> returns the authenticated user with a valid token', async () => {
    const access_token = await registerAndLogin();

    const res = await request(app.getHttpServer())
      .get('/users/self')
      .set('Authorization', `Bearer ${access_token}`)
      .expect(200);

    expect(res.body.username).toBe('users_self_e2e');
    expect(res.body.email).toBe('users_self_e2e@example.com');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('GET /users/self -> rejects with 401 when no token is provided', async () => {
    await request(app.getHttpServer()).get('/users/self').expect(401);
  });

  it('GET /users/self -> rejects with 401 when the token is invalid', async () => {
    await request(app.getHttpServer())
      .get('/users/self')
      .set('Authorization', 'Bearer garbage.token.value')
      .expect(401);
  });

  describe('POST /users/avatar', () => {
    const registerAndLoginForAvatar = async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'users_avatar_e2e',
          email: 'users_self_e2e@example.com',
          password: 'password123',
        })
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'users_self_e2e@example.com',
          password: 'password123',
        })
        .expect(200);

      return loginRes.body.access_token as string;
    };

    const trackUploadedAvatar = (avatarUrl: string) => {
      const filePath = join(
        process.cwd(),
        AVATAR_CONSTANTS.UPLOAD_DIR_REL,
        basename(avatarUrl),
      );
      uploadedAvatarPaths.push(filePath);
      return filePath;
    };

    it('uploads a valid PNG and serves the stored avatar', async () => {
      const accessToken = await registerAndLoginForAvatar();

      const response = await request(app.getHttpServer())
        .post('/users/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', pngFile, 'avatar.png')
        .expect(201);

      expect(response.body.avatar).toMatch(
        /^api\/static\/avatars\/uploads\/[0-9a-f-]+\.png$/,
      );

      const filePath = trackUploadedAvatar(response.body.avatar);
      await expect(fs.stat(filePath)).resolves.toBeDefined();

      await request(app.getHttpServer())
        .get(response.body.avatar.replace(/^api/, ''))
        .expect(200)
        .expect('Content-Type', /image\/png/);
    });

    it('replaces the old avatar and deletes its file', async () => {
      const accessToken = await registerAndLoginForAvatar();
      const upload = (filename: string) =>
        request(app.getHttpServer())
          .post('/users/avatar')
          .set('Authorization', `Bearer ${accessToken}`)
          .attach('avatar', pngFile, filename)
          .expect(201);

      const firstResponse = await upload('first.png');
      const firstFilePath = trackUploadedAvatar(firstResponse.body.avatar);
      await expect(fs.stat(firstFilePath)).resolves.toBeDefined();

      const secondResponse = await upload('second.png');
      const secondFilePath = trackUploadedAvatar(secondResponse.body.avatar);

      await expect(fs.stat(secondFilePath)).resolves.toBeDefined();
      await expect(fs.stat(firstFilePath)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });

    it('rejects an avatar larger than the configured size limit and leaves no orphaned file', async () => {
      const accessToken = await registerAndLoginForAvatar();
      const uploadDir = join(process.cwd(), AVATAR_CONSTANTS.UPLOAD_DIR_REL);

      // 1. Snapshot directory before upload
      const filesBefore = await fs.readdir(uploadDir);

      const oversizedFile = Buffer.alloc(
        AVATAR_CONSTANTS.MAX_FILE_SIZE_BYTES + 1,
      );

      // 2. Perform upload
      const response = await request(app.getHttpServer())
        .post('/users/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', oversizedFile, 'oversized.png');

      expect([400, 413]).toContain(response.status);

      // 3. Verify directory contents after upload (no new files created or left behind)
      const filesAfter = await fs.readdir(uploadDir);
      expect(filesAfter).toEqual(filesBefore);
    });

    it('rejects an unsupported file type', async () => {
      const accessToken = await registerAndLoginForAvatar();

      await request(app.getHttpServer())
        .post('/users/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('avatar', Buffer.from('not an image'), 'avatar.txt')
        .expect(400);
    });

    it('rejects a request without an avatar file', async () => {
      const accessToken = await registerAndLoginForAvatar();

      await request(app.getHttpServer())
        .post('/users/avatar')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('rejects an unauthenticated avatar upload', async () => {
      await request(app.getHttpServer())
        .post('/users/avatar')
        .attach('avatar', pngFile, 'avatar.png')
        .expect(401);
    });
  });
});
