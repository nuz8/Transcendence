import { AuthService } from '../authService';
import { InMemoryUserRepository } from '../test-utils/inMemoryUserRepository';
import { BcryptPasswordHasher } from '../bcryptPasswordHasher';

describe('AuthService', () => {
  const hasher = new BcryptPasswordHasher();

  it('authenticates a user with correct credentials', async () => {
    const passwordHash = await hasher.hash('pass123');
    const repo = new InMemoryUserRepository([
      { id: '1', email: 'test@test.com', passwordHash },
    ]);
    const authService = new AuthService(repo, hasher);

    const result = await authService.authenticate('test@test.com', 'pass123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.user.email).toBe('test@test.com');
    }
  });

  it('rejects an unknown email', async () => {
    const repo = new InMemoryUserRepository([]);
    const authService = new AuthService(repo, hasher);

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
    const authService = new AuthService(repo, hasher);

    const result = await authService.authenticate('test@test.com', 'wrongpass');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe('INVALID_CREDENTIALS');
    }
  });
});
