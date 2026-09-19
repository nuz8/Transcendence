import { AuthService } from '../auth.service';
import { InMemoryUserRepository } from '../test-utils/inMemoryUserRepository';
import { BcryptPasswordHasher } from '../bcryptPasswordHasher';
import { JwtService } from '@nestjs/jwt';
import { AllowList } from '../allowList';
import { randomUUID } from 'node:crypto';

describe('AuthService', () => {
  const hasher = new BcryptPasswordHasher();
  const jwtService = new JwtService({ secret: 'test-secret' });
  const allowList = new AllowList();

  it('authenticates a user with correct credentials', async () => {
    const passwordHash = await hasher.hash('pass123');
    const repo = new InMemoryUserRepository([
      { id: '1', email: 'test@test.com', passwordHash },
    ]);
    const authService = new AuthService(repo, hasher, jwtService, allowList);

    const result = await authService.authenticate('test@test.com', 'pass123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user.email).toBe('test@test.com');
      expect(result.access_token).toEqual(expect.any(String));
      expect(result.refresh_token).toEqual(expect.any(String));

    }
  });

  it('rejects an unknown email', async () => {
    const repo = new InMemoryUserRepository([]);
    const authService = new AuthService(repo, hasher, jwtService, allowList);

    const result = await authService.authenticate('unknown@test.com', 'x');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe('INVALID_CREDENTIALS');
    }
  });

  it('rejects an incorrect password with the same generic error', async () => {
    const passwordHash = await hasher.hash('correctpass');
    const repo = new InMemoryUserRepository([
      { id: '1', email: 'test@test.com', passwordHash },
    ]);
    const authService = new AuthService(repo, hasher, jwtService, allowList);

    const result = await authService.authenticate('test@test.com', 'wrongpass');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe('INVALID_CREDENTIALS');
    }
  });

  it('issues a new access token and a new refresh token for a valid refresh token', async () => {
    const authService = new AuthService(new InMemoryUserRepository([]), hasher, jwtService, allowList);
    const jti = randomUUID();
    const refresh_token = await jwtService.signAsync({ sub: '1', type: 'refresh', jti }, { expiresIn: '7d' });
    allowList.add(jti, Date.now() + 60_000);

    const result = await authService.refresh(refresh_token);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.access_token).toEqual(expect.any(String));
      expect(result.refresh_token).toEqual(expect.any(String));
      expect(result.refresh_token).not.toBe(refresh_token);
    }
  });


  it('rejects an access token used as a refresh token', async () => {
    const authService = new AuthService(new InMemoryUserRepository([]), hasher, jwtService, allowList);
    const access_token = await jwtService.signAsync({ sub: '1', type: 'access' });

    const result = await authService.refresh(access_token);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe('INVALID_REFRESH_TOKEN');
    }
  });
  
  it('rejects a refresh token not present in the allow list', async () => {
    const authService = new AuthService(new InMemoryUserRepository([]), hasher, jwtService, allowList);
    const refresh_token = await jwtService.signAsync({ sub: '1', type: 'refresh', jti: randomUUID() }, { expiresIn: '7d' });

    const result = await authService.refresh(refresh_token);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe('INVALID_REFRESH_TOKEN');
    }
  });

  it('invalidates the old refresh token after rotation', async () => {
    const authService = new AuthService(new InMemoryUserRepository([]), hasher, jwtService, allowList);
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