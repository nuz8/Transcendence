import * as AuthModule from '../index';

describe('auth module public API', () => {
  it('exports AuthService', () => {
    expect(AuthModule.AuthService).toBeDefined();
  });

  it('does not export internal test utilities', () => {
    expect((AuthModule as any).InMemoryUserRepository).toBeUndefined();
  });
});