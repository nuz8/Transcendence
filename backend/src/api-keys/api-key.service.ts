import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { API_KEY_PREFIX, MAX_API_KEYS_PER_USER } from './api-key.constants';
import { ApiKeyRepository, type ApiKeyRow } from './api-key.repository';

const hashOf = (key: string): string => createHash('sha256').update(key).digest('hex');

@Injectable()
export class ApiKeyService {
	constructor(private readonly apiKeyRepo: ApiKeyRepository) {}

	async create(userId: string): Promise<ApiKeyRow & { key: string }> {
		if (await this.apiKeyRepo.countByUser(userId) >= MAX_API_KEYS_PER_USER)
			throw new ConflictException('API_KEY_LIMIT_REACHED');

		const key = API_KEY_PREFIX + randomBytes(32).toString('base64url');
		const row = await this.apiKeyRepo.create(userId, hashOf(key), key.slice(0, 8));
		return { ...row, key };
	}

	list(userId: string): Promise<ApiKeyRow[]> {
		return this.apiKeyRepo.listByUser(userId);
	}

	async revoke(userId: string, id: string): Promise<void> {
		if (!(await this.apiKeyRepo.remove(id, userId)))
			throw new NotFoundException('API_KEY_NOT_FOUND');
	}

	resolve(key: string): Promise<{ keyId: string; userId: string } | null> {
		return this.apiKeyRepo.findOwner(hashOf(key));
	}
}
