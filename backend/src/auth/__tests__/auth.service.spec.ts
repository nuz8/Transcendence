import { AuthService } from '../auth.service';
import { InMemoryUserRepository } from '../test-utils/inMemoryUserRepository';
import { BcryptPasswordHasher } from '../bcryptPasswordHasher';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  const hasher = new BcryptPasswordHasher();
  const jwtService = new JwtService({ secret: 'test-secret' });


  it('authenticates a user with correct credentials', async () => {
    const passwordHash = await hasher.hash('pass123');
    const repo = new InMemoryUserRepository([
      { id: '1', email: 'test@test.com', passwordHash },
    ]);
    const authService = new AuthService(repo, hasher, jwtService);

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
    const authService = new AuthService(repo, hasher, jwtService);

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
    const authService = new AuthService(repo, hasher, jwtService);

    const result = await authService.authenticate('test@test.com', 'wrongpass');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe('INVALID_CREDENTIALS');
    }
  });

  it('issues a new access token for a valid refresh token', async () => {
    const authService = new AuthService(new InMemoryUserRepository([]), hasher, jwtService);
    const refresh_token = await jwtService.signAsync({ sub: '1', type: 'refresh' }, { expiresIn: '7d' });

    const result = await authService.refresh(refresh_token);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.access_token).toEqual(expect.any(String));
    }
  });

  it('rejects an access token used as a refresh token', async () => {
    const authService = new AuthService(new InMemoryUserRepository([]), hasher, jwtService);
    const access_token = await jwtService.signAsync({ sub: '1', type: 'access' });

    const result = await authService.refresh(access_token);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe('INVALID_REFRESH_TOKEN');
    }
  });

});