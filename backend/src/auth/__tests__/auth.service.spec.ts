import { JwtService } from '@nestjs/jwt';
import { like } from 'drizzle-orm';
import db from '../../db/client';
import { users } from '../../db/schema';
import { UserRepository, UserService } from '../../users';
import { AuthService } from '../auth.service';
import { BcryptPasswordHasher } from '../bcryptPasswordHasher';
import { AllowList } from '../allowList';
import { randomUUID } from 'node:crypto';

describe('AuthService', () => {
  const TEST_DOMAIN = '@auth-suite.local';
  const makeEmail = (name: string) => `${name}${TEST_DOMAIN}`;

  const hasher = new BcryptPasswordHasher();
  const jwtService = new JwtService({ secret: 'test-jwt-secret' });
  const allowList = new AllowList();
  const userRepository = new UserRepository(db);
  const userService = new UserService(userRepository);
  const authService = new AuthService(userService, hasher, jwtService, allowList);

  const cleanTestSuiteUsers = async () => {
    await db.delete(users).where(like(users.email, `%${TEST_DOMAIN}`));
  };

  const seedUser = async (
    username: string,
    email: string,
    plainTextPassword = 'password123',
  ) => {
    const passwordHash = await hasher.hash(plainTextPassword);
    return userService.createUser(username, email, passwordHash);
  };

  beforeEach(async () => {
    await cleanTestSuiteUsers();
  });

  afterAll(async () => {
    await cleanTestSuiteUsers();
    await db.$client.end();
  });

  describe('authenticate', () => {
    it('authenticates an existing user and issues access and refresh tokens', async () => {
      const email = makeEmail('valid-user');
      const password = 'securePassword!45';
      await seedUser('valid_user', email, password);

      const result = await authService.authenticate(email, password);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.user.email).toBe(email);
      expect(result.access_token).toEqual(expect.any(String));
      expect(result.refresh_token).toEqual(expect.any(String));
    });

    it('rejects authentication when email is not registered', async () => {
      const result = await authService.authenticate(
        makeEmail('ghost'),
        'anyPassword',
      );

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.reason).toBe('INVALID_CREDENTIALS');
    });

    it('rejects authentication with generic error when password does not match', async () => {
      const email = makeEmail('wrong-pass-user');
      await seedUser('wrong_pass_user', email, 'correctSecret');

      const result = await authService.authenticate(email, 'incorrectSecret');

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.reason).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('refresh', () => {
    it('issues a fresh access token given a valid refresh token', async () => {
      const jti = randomUUID();
      const refreshToken = await jwtService.signAsync({ sub: '1', type: 'refresh', jti }, { expiresIn: '7d' });
      allowList.add(jti, Date.now() + 60_000);
      const result = await authService.refresh(refreshToken);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.access_token).toEqual(expect.any(String));
    });

    it('rejects token refresh when provided with an access token instead', async () => {
      const accessToken = await jwtService.signAsync({
        sub: 'test-user-id',
        type: 'access',
      });

      const result = await authService.refresh(accessToken);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.reason).toBe('INVALID_REFRESH_TOKEN');
    });

    it('rejects a refresh token not present in the allow list', async () => {
      const refresh_token = await jwtService.signAsync({ sub: '1', type: 'refresh', jti: randomUUID() }, { expiresIn: '7d' });

      const result = await authService.refresh(refresh_token);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('INVALID_REFRESH_TOKEN');
      }
    });

    it('invalidates the old refresh token after rotation', async () => {
      const jti = randomUUID();
      const refresh_token = await jwtService.signAsync({ sub: '1', type: 'refresh', jti }, { expiresIn: '7d' });
      allowList.add(jti, Date.now() + 60_000);

      await authService.refresh(refresh_token);
      const result = await authService.refresh(refresh_token);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('INVALID_REFRESH_TOKEN');
      }
    });

  });

  describe('register', () => {
    it('registers a new user and returns public user details without leaking password hash', async () => {
      const email = makeEmail('new-member');

      const result = await authService.register(
        'new_member',
        email,
        'mySecret123',
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.user.id).toBeDefined();
      expect(result.user.username).toBe('new_member');
      expect(result.user.email).toBe(email);
      expect('passwordHash' in result.user).toBe(false);
    });

    it('persists password as a verifiable hash rather than plain text', async () => {
      const email = makeEmail('hashed-member');
      const rawPassword = 'superSecretPassword!';

      await authService.register('hashed_member', email, rawPassword);

      const persisted = await userRepository.findByEmail(email);
      expect(persisted).not.toBeNull();
      expect(persisted!.passwordHash).not.toBe(rawPassword);

      const isMatch = await hasher.verify(rawPassword, persisted!.passwordHash);
      expect(isMatch).toBe(true);
    });

    it('rejects registration when username is already in use', async () => {
      const existingUsername = 'duplicate_username';
      await seedUser(existingUsername, makeEmail('first-owner'), 'password');

      const result = await authService.register(
        existingUsername,
        makeEmail('second-attempt'),
        'password',
      );

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.reason).toBe('USERNAME_ALREADY_EXISTS');
    });

    it('rejects registration when email is already in use', async () => {
      const existingEmail = makeEmail('shared-mailbox');
      await seedUser('user_one', existingEmail, 'password');

      const result = await authService.register(
        'user_two',
        existingEmail,
        'password',
      );

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.reason).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('handles multiple concurrent registration requests for the same credentials with only one winner', async () => {
      const CONCURRENT_REQUESTS_COUNT = 3;
      const targetUsername = 'concurrent_user';
      const targetEmail = makeEmail('concurrent-target');

      const requests = Array.from({ length: CONCURRENT_REQUESTS_COUNT }, () =>
        authService.register(targetUsername, targetEmail, 'concurrentPass123'),
      );

      const results = await Promise.all(requests);
      const successfulRegistrations = results.filter((res) => res.success);
      const failedRegistrations = results.filter((res) => !res.success);

      expect(successfulRegistrations).toHaveLength(1);
      expect(failedRegistrations).toHaveLength(CONCURRENT_REQUESTS_COUNT - 1);

      for (const failed of failedRegistrations) {
        if (!failed.success) {
          expect(['USERNAME_ALREADY_EXISTS', 'EMAIL_ALREADY_EXISTS']).toContain(
            failed.reason,
          );
        }
      }
    });
  });
});
