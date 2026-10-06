import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from '../user.service';
import { UserRepository, UserConflictError } from '../user.repository';
import { UserEntity } from '../user.entity';
import { USER_CONSTRAINTS, AVATAR_CONSTANTS } from '../user.constants';
import { DB_PROVIDER } from '../../db/db.provider';
import { PG_ERROR_CODES } from '../../db';

describe('UserService - updateProfile', () => {
  let service: UserService;
  let userRepo: {
    findById: jest.Mock;
    updateUsername: jest.Mock;
  };

  const mockUser = new UserEntity({
    id: 'user-uuid-1',
    username: 'original_user',
    email: 'user@example.com',
    avatar: AVATAR_CONSTANTS.DEFAULT_AVATAR_PATH,
    passwordHash: 'hashed_pw',
    xp: 0,
  });

  beforeEach(async () => {
    userRepo = {
      findById: jest.fn(),
      updateUsername: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: UserRepository, useValue: userRepo }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('empty patch (username is undefined)', () => {
    it('returns existing user profile when username is undefined', async () => {
      userRepo.findById.mockResolvedValue(mockUser);

      const result = await service.updateProfile(mockUser.id, undefined);

      expect(userRepo.findById).toHaveBeenCalledWith(mockUser.id);
      expect(userRepo.updateUsername).not.toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('throws NotFoundException if user is not found in database on empty patch', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent-id', undefined),
      ).rejects.toThrow(NotFoundException);

      expect(userRepo.findById).toHaveBeenCalledWith('non-existent-id');
      expect(userRepo.updateUsername).not.toHaveBeenCalled();
    });
  });

  describe('username update', () => {
    it('successfully updates and returns the updated user entity', async () => {
      const updatedUser = new UserEntity({
        ...mockUser,
        username: 'new_username',
      });
      userRepo.updateUsername.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(mockUser.id, 'new_username');

      expect(userRepo.updateUsername).toHaveBeenCalledWith(
        mockUser.id,
        'new_username',
      );
      expect(result.username).toBe('new_username');
    });

    it('throws NotFoundException if user is not found or soft-deleted during update', async () => {
      userRepo.updateUsername.mockResolvedValue(null);

      await expect(
        service.updateProfile('deleted-user-id', 'new_username'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException with USERNAME_ALREADY_EXISTS when repository throws UserConflictError', async () => {
      userRepo.updateUsername.mockRejectedValue(
        new UserConflictError('username'),
      );

      await expect(
        service.updateProfile(mockUser.id, 'taken_username'),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.updateProfile(mockUser.id, 'taken_username'),
      ).rejects.toMatchObject({
        message: 'USERNAME_ALREADY_EXISTS',
      });
    });

    it('re-throws unexpected database or system errors', async () => {
      const dbError = new Error('Database connection failed');
      userRepo.updateUsername.mockRejectedValue(dbError);

      await expect(
        service.updateProfile(mockUser.id, 'new_username'),
      ).rejects.toThrow('Database connection failed');
    });
  });
});

describe('UserRepository - updateUsername conflict mapping', () => {
  let repository: UserRepository;
  let mockDb: {
    update: jest.Mock;
  };

  beforeEach(async () => {
    mockDb = {
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserRepository, { provide: DB_PROVIDER, useValue: mockDb }],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  it('translates Postgres unique violation on username into UserConflictError', async () => {
    const uniqueError = {
      code: PG_ERROR_CODES.UNIQUE_VIOLATION,
      constraint: USER_CONSTRAINTS.USERNAME_UNIQUE,
    };

    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(uniqueError),
        }),
      }),
    });

    await expect(
      repository.updateUsername('user-1', 'clashing_username'),
    ).rejects.toThrow(UserConflictError);

    try {
      await repository.updateUsername('user-1', 'clashing_username');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(UserConflictError);
      if (err instanceof UserConflictError) {
        expect(err.field).toBe('username');
      }
    }
  });

  it('re-throws unrecognized errors as-is without wrapping in UserConflictError', async () => {
    const unknownError = new Error('Syntax error in query');

    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(unknownError),
        }),
      }),
    });

    await expect(
      repository.updateUsername('user-1', 'any_username'),
    ).rejects.toThrow('Syntax error in query');
  });
});
