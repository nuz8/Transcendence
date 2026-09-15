import { Test, TestingModule } from '@nestjs/testing';
import { UserRepository, UserService, UserEntity, AVATAR_CONSTANTS } from './';
import { DB_PROVIDER } from '../db/db.provider';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import * as avatarHelpers from './avatar.helpers';

jest.mock('./avatar.helpers', () => {
  const actual = jest.requireActual('./avatar.helpers');
  return {
    ...actual,
    isValidImageFile: jest.fn(),
  };
});

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        UserRepository,
        { provide: DB_PROVIDER, useValue: {} },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('UserService - Avatar Management', () => {
  let service: UserService;
  let userRepo: {
    findById: jest.Mock;
    updateAvatar: jest.Mock;
    findByUsername: jest.Mock;
    findByEmail: jest.Mock;
    createUser: jest.Mock;
  };

  const mockUser = new UserEntity({
    id: 'user-uuid-1',
    username: 'testuser',
    email: 'test@example.com',
    avatar: AVATAR_CONSTANTS.DEFAULT_AVATAR_PATH,
    passwordHash: 'hashed_pw',
  });

  beforeEach(async () => {
    userRepo = {
      findById: jest.fn(),
      updateAvatar: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      createUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: userRepo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);

    // Spy on fs.unlink and mock resolved value so real files aren't deleted
    jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);

    // Default to valid image for general business logic tests
    jest.mocked(avatarHelpers.isValidImageFile).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateAvatar', () => {
    it('throws NotFoundException and cleans up uploaded file if user is not found', async () => {
      userRepo.findById.mockResolvedValue(null);

      const newFilename = 'new-avatar.png';
      const expectedDiskPath = join(
        process.cwd(),
        AVATAR_CONSTANTS.UPLOAD_DIR_REL,
        newFilename,
      );

      await expect(
        service.updateAvatar('non-existent-id', newFilename),
      ).rejects.toThrow(NotFoundException);

      // Verify the new file was deleted
      expect(fs.unlink).toHaveBeenCalledWith(expectedDiskPath);
      expect(userRepo.updateAvatar).not.toHaveBeenCalled();
    });

    it('throws BadRequestException and cleans up file if magic bytes validation fails', async () => {
      userRepo.findById.mockResolvedValue(mockUser);
      jest.mocked(avatarHelpers.isValidImageFile).mockResolvedValue(false);

      const fakeImageFilename = 'fake-image.png';
      const expectedDiskPath = join(
        process.cwd(),
        AVATAR_CONSTANTS.UPLOAD_DIR_REL,
        fakeImageFilename,
      );

      await expect(
        service.updateAvatar(mockUser.id, fakeImageFilename),
      ).rejects.toThrow(BadRequestException);

      expect(fs.unlink).toHaveBeenCalledWith(expectedDiskPath);
      expect(userRepo.updateAvatar).not.toHaveBeenCalled();
    });

    it('updates avatar and does NOT delete default avatar on first upload', async () => {
      userRepo.findById.mockResolvedValue(mockUser);

      const newFilename = 'new-avatar.png';
      const expectedUrl = `${AVATAR_CONSTANTS.UPLOAD_URL_PREFIX}/${newFilename}`;

      const updatedUser = new UserEntity({
        ...mockUser,
        avatar: expectedUrl,
      });
      userRepo.updateAvatar.mockResolvedValue(updatedUser);

      const result = await service.updateAvatar(mockUser.id, newFilename);

      expect(userRepo.updateAvatar).toHaveBeenCalledWith(mockUser.id, expectedUrl);
      expect(result.avatar).toBe(expectedUrl);

      // Verify fs.unlink was NEVER called (default avatar protected)
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('updates avatar and deletes previous custom avatar', async () => {
      const userWithCustomAvatar = new UserEntity({
        ...mockUser,
        avatar: `${AVATAR_CONSTANTS.UPLOAD_URL_PREFIX}/old-avatar.png`,
      });
      userRepo.findById.mockResolvedValue(userWithCustomAvatar);

      const newFilename = 'brand-new-avatar.png';
      const expectedNewUrl = `${AVATAR_CONSTANTS.UPLOAD_URL_PREFIX}/${newFilename}`;

      const updatedUser = new UserEntity({
        ...userWithCustomAvatar,
        avatar: expectedNewUrl,
      });
      userRepo.updateAvatar.mockResolvedValue(updatedUser);

      const result = await service.updateAvatar(userWithCustomAvatar.id, newFilename);

      expect(userRepo.updateAvatar).toHaveBeenCalledWith(
        userWithCustomAvatar.id,
        expectedNewUrl,
      );
      expect(result.avatar).toBe(expectedNewUrl);

      // Verify fs.unlink was called with the old custom avatar
      const expectedOldDiskPath = join(
        process.cwd(),
        AVATAR_CONSTANTS.UPLOAD_DIR_REL,
        'old-avatar.png',
      );
      expect(fs.unlink).toHaveBeenCalledWith(expectedOldDiskPath);
    });

    it('cleans up uploaded file and rethrows error if repository update fails', async () => {
      userRepo.findById.mockResolvedValue(mockUser);
      userRepo.updateAvatar.mockRejectedValue(new Error('DB Connection Timeout'));

      const newFilename = 'failed-upload.png';
      const expectedDiskPath = join(
        process.cwd(),
        AVATAR_CONSTANTS.UPLOAD_DIR_REL,
        newFilename,
      );

      await expect(
        service.updateAvatar(mockUser.id, newFilename),
      ).rejects.toThrow('DB Connection Timeout');

      // Verify the new file was cleaned up (rollback)
      expect(fs.unlink).toHaveBeenCalledWith(expectedDiskPath);
    });
  });

  describe('path traversal attacks', () => {
    it('sanitizes filename to prevent path traversal during rollback cleanup', async () => {
      userRepo.findById.mockResolvedValue(null);

      const maliciousFilename = '../../secrets/key.pem';
      await expect(
        service.updateAvatar('non-existent-id', maliciousFilename),
      ).rejects.toThrow(NotFoundException);

      const expectedSafeDiskPath = join(
        process.cwd(),
        AVATAR_CONSTANTS.UPLOAD_DIR_REL,
        'key.pem',
      );
      expect(fs.unlink).toHaveBeenCalledWith(expectedSafeDiskPath);
    });

    it('sanitizes old avatar path to prevent path traversal when deleting previous avatar', async () => {
      const userWithTraversalAvatar = new UserEntity({
        ...mockUser,
        avatar: `${AVATAR_CONSTANTS.UPLOAD_URL_PREFIX}/../../secrets/key.pem`,
      });
      userRepo.findById.mockResolvedValue(userWithTraversalAvatar);

      const newFilename = 'valid-new-avatar.png';
      const expectedNewUrl = `${AVATAR_CONSTANTS.UPLOAD_URL_PREFIX}/${newFilename}`;

      userRepo.updateAvatar.mockResolvedValue(
        new UserEntity({ ...mockUser, avatar: expectedNewUrl }),
      );

      await service.updateAvatar(userWithTraversalAvatar.id, newFilename);

      const expectedSafeDiskPath = join(
        process.cwd(),
        AVATAR_CONSTANTS.UPLOAD_DIR_REL,
        'key.pem',
      );
      expect(fs.unlink).toHaveBeenCalledWith(expectedSafeDiskPath);
    });

    it('does not unlink any file if old avatar path is outside the uploads directory', async () => {
      const userWithExternalAvatar = new UserEntity({
        ...mockUser,
        avatar: '/static/avatars/../secrets/key.pem',
      });
      userRepo.findById.mockResolvedValue(userWithExternalAvatar);

      const newFilename = 'valid-new-avatar.png';
      const expectedNewUrl = `${AVATAR_CONSTANTS.UPLOAD_URL_PREFIX}/${newFilename}`;

      userRepo.updateAvatar.mockResolvedValue(
        new UserEntity({ ...mockUser, avatar: expectedNewUrl }),
      );

      await service.updateAvatar(userWithExternalAvatar.id, newFilename);

      // Verify fs.unlink was never called because it does not match UPLOAD_URL_PREFIX
      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });
});
