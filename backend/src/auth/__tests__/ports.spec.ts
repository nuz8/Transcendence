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

  it('findById returns null when no user matches', async () => {
    const repo = new UserRepository(db);
    const result = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

});
