import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import db from '../src/db/client';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { WsAdapter } from '@nestjs/platform-ws';


describe('Users Self (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
});
