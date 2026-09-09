import db from '../../db/client';
import { UserRepository } from '../../users';

describe('UserRepository port', () => {
  afterAll(async () => {
    await db.$client.end();
  });
  
  it('accepts a valid implementation', async () => {
    const repo = new UserRepository(db);
    const result = await repo.findByEmail('test@test.com');
    expect(result).toBeNull();
  });
});
