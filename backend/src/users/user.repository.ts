import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { UserEntity } from './user.entity';
import { USER_CONSTRAINTS } from './user.constants';
import {
	type DB,
	InjectDb,
	PG_ERROR_CODES,
	getPgErrorInfo,
	users,
} from '../db';

export class UserConflictError extends Error {
	constructor(public readonly field: 'username' | 'email') {
		super(`${field.toUpperCase()}_ALREADY_EXISTS`);
	}
}

@Injectable()
export class UserRepository {
	constructor(@InjectDb() private readonly db:DB) { }

	async findByUsername(username: string): Promise<UserEntity | null> {
		const rows = await this.db
			.select()
			.from(users)
			.where(and(eq(users.username, username), isNull(users.deletedAt)))
			.limit(1);

		const user = rows[0];

		return (
			user
			? new UserEntity({
				id: user.id,
				username: user.username,
				email: user.email,
				avatar: user.avatar,
				passwordHash: user.passwordHash,
			})
			: null
		);
	}

	async findByEmail(email: string): Promise<UserEntity | null> {
		const rows = await this.db
			.select()
			.from(users)
			.where(and(eq(users.email, email), isNull(users.deletedAt)))
			.limit(1);

		const user = rows[0];

		return (
			user
			? new UserEntity({
				id: user.id,
				username: user.username,
				email: user.email,
				avatar: user.avatar,
				passwordHash: user.passwordHash,
			})
			: null
		);
	}

	async findById(id: string): Promise<UserEntity | null> {
		const rows = await this.db
			.select()
			.from(users)
			.where(and(eq(users.id, id), isNull(users.deletedAt)))
			.limit(1);

		const user = rows[0];

		return (
			user
			? new UserEntity({
				id: user.id,
				username: user.username,
				email: user.email,
				avatar: user.avatar,
				passwordHash: user.passwordHash,
			})
			: null
		);
	}


	async createUser(
		username: string,
		email: string,
		passwordHash: string
	): Promise<UserEntity> {
		try {
			const rows = await this.db
				.insert(users)
				.values({ username, email, passwordHash })
				.returning();
			const user = rows[0];
			if (!user) {
				throw new Error('User was not created.');
			}
			return new UserEntity({
				id: user.id,
				username: user.username,
				email: user.email,
				avatar: user.avatar,
				passwordHash: user.passwordHash,
			});
		} catch (error: any) {
			const { code, constraint } = getPgErrorInfo(error);
			if (code === PG_ERROR_CODES.UNIQUE_VIOLATION) {
				if (constraint === USER_CONSTRAINTS.USERNAME_UNIQUE) {
					throw new UserConflictError('username');
				}
				if (constraint === USER_CONSTRAINTS.EMAIL_UNIQUE) {
					throw new UserConflictError('email');
				}
			}
			throw error;
		}
	}
}
