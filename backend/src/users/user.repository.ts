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

export type UserProfileData = {
	id: string;
	username: string;
	avatar: string;
	xp: number;
};

export type SelfProfileData = UserProfileData & { email: string; };

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

	private toConflict(error: any): unknown {
		const { code, constraint } = getPgErrorInfo(error);
		if (code === PG_ERROR_CODES.UNIQUE_VIOLATION) {
			if (constraint === USER_CONSTRAINTS.USERNAME_UNIQUE) {
				return new UserConflictError('username');
			}
			if (constraint === USER_CONSTRAINTS.EMAIL_UNIQUE) {
				return new UserConflictError('email');
			}
		}

		return error;
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
			throw this.toConflict(error);
		}
	}

	async updateAvatar(id: string, avatarUrl: string): Promise<UserEntity | null> {
		const rows = await this.db
			.update(users)
			.set({ avatar: avatarUrl })
			.where(and(eq(users.id, id), isNull(users.deletedAt)))
			.returning();
		
		const user = rows[0];
		return user
			? new UserEntity({
					id: user.id,
					username: user.username,
					email: user.email,
					avatar: user.avatar,
					passwordHash: user.passwordHash,
				})
			: null;
	}

	async updateUsername(id: string, username: string): Promise<UserEntity | null> {
		try {
			const rows = await this.db
				.update(users)
				.set({ username })
				.where(and(eq(users.id, id), isNull(users.deletedAt)))
				.returning();
			const user = rows[0];
			return user
				? new UserEntity({
						id: user.id,
						username: user.username,
						email: user.email,
						avatar: user.avatar,
						passwordHash: user.passwordHash,
					})
				: null;
		} catch (error: any) {
			throw this.toConflict(error);
		}
	}

	async findProfileById(id: string): Promise<UserProfileData | null> {
		const [row] = await this.db
			.select({
				id: users.id,
				username: users.username,
				avatar: users.avatar,
				xp: users.xp,
			})
			.from(users)
			.where(and(eq(users.id, id), isNull(users.deletedAt)))
			.limit(1);
		
		return row ?? null;
	}

	async findSelfProfileById(id: string): Promise<SelfProfileData | null> {
		const [row] = await this.db
            .select({
                id: users.id,
                username: users.username,
                email: users.email,
                avatar: users.avatar,
                xp: users.xp,
            })
            .from(users)
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
            .limit(1);

        return row ?? null;
	}
}
