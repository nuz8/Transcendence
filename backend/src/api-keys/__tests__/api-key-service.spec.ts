import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiKeyRepository } from '../api-key.repository';
import { ApiKeyService } from '../api-key.service';
import { MAX_API_KEYS_PER_USER } from '../api-key.constants';

describe('ApiKeyService', () => {
	let repo: { create: jest.Mock; countByUser: jest.Mock; listByUser: jest.Mock; remove: jest.Mock; findOwner: jest.Mock };
	let service: ApiKeyService;

	beforeEach(() => {
		repo = { create: jest.fn(), countByUser: jest.fn().mockResolvedValue(0), listByUser: jest.fn(), remove: jest.fn(), findOwner: jest.fn() };
		repo.create.mockImplementation(async (_userId: string, _hash: string, prefix: string) => ({ id: 'key-1', prefix, createdAt: new Date() }));
		service = new ApiKeyService(repo as unknown as ApiKeyRepository);
	});

	it('returns the key once and stores only its hash and prefix', async () => {
		const created = await service.create('user-1');

		expect(created.key).toMatch(/^tk_[A-Za-z0-9_-]{43}$/);
		const [userId, storedHash, prefix] = repo.create.mock.calls[0];
		expect(userId).toBe('user-1');
		expect(storedHash).toBe(createHash('sha256').update(created.key).digest('hex'));
		expect(prefix).toBe(created.key.slice(0, 8));
		expect(created.prefix).toBe(prefix);
	});

	it('gives two different keys on two calls', async () => {
		const first = await service.create('user-1');
		const second = await service.create('user-1');

		expect(first.key).not.toBe(second.key);
	});

	it('refuses a key beyond the limit per user', async () => {
		repo.countByUser.mockResolvedValue(MAX_API_KEYS_PER_USER);

		await expect(service.create('user-1')).rejects.toThrow(ConflictException);
		expect(repo.create).not.toHaveBeenCalled();
	});

	it('looks a key up by its hash, never by the key itself', async () => {
		repo.findOwner.mockResolvedValue({ keyId: 'key-1', userId: 'user-1' });

		await expect(service.resolve('tk_secret')).resolves.toEqual({ keyId: 'key-1', userId: 'user-1' });
		expect(repo.findOwner).toHaveBeenCalledWith(createHash('sha256').update('tk_secret').digest('hex'));
	});

	it('answers not found when revoking a key that is not yours', async () => {
		repo.remove.mockResolvedValue(false);

		await expect(service.revoke('user-1', 'key-9')).rejects.toThrow(NotFoundException);
		expect(repo.remove).toHaveBeenCalledWith('key-9', 'user-1');
	});
});
