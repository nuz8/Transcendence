import { InMemoryUserRepository } from '../test-utils/inMemoryUserRepository';

describe('UserRepository port', () => {
  it('accepts a valid implementation', async () => {
    const repo = new InMemoryUserRepository([]);
    const result = await repo.findByEmail('test@test.com');
    expect(result).toBeNull();
  });
});
