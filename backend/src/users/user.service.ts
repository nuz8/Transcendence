import { BadRequestException, Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { UserRepository, UserConflictError } from './user.repository';
import { UserEntity } from './user.entity';
import { AVATAR_CONSTANTS } from './user.constants';
import { basename, join } from 'node:path';
import { promises as fs } from 'node:fs';
import { isNodeError, isValidImageFile } from './avatar.helpers';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(private readonly userRepo: UserRepository) { }

  async findByUsername(username: string): Promise<UserEntity | null> {
    return this.userRepo.findByUsername(username);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findByEmail(email);
  }

  async findById(id: string): Promise<UserEntity | null> {
		return this.userRepo.findById(id);
	}

  async createUser(
    username: string,
    email: string,
    passwordHash: string
  ): Promise<UserEntity> {
    return this.userRepo.createUser(username, email, passwordHash);
  }

  async updateProfile(userId: string, username?: string): Promise<UserEntity> {
    if (username === undefined){
      const user = await this.userRepo.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    }

    try {
      const user = await this.userRepo.updateUsername(userId, username);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    } catch (error) {
      if (error instanceof UserConflictError && error.field === 'username') {
        throw new ConflictException('USERNAME_ALREADY_EXISTS');
      }
      throw error;
    }
  }
  /** Helper fn to build safe file path, and delete it from disk without throwing.
   * Safely deletes a file from the uploads directory by filename.
   * Uses path.basename to prevent path traversal attacks.
   * Ignores ENOENT (file not found), the desired outcome is achieved if the file is not there.
   * Logs any other unexpected disk or file system error (eg. permission error).
  */
  private async safelyRemoveFileByName(filename: string): Promise<void> {
    const safeDiskPath = join(  // Build safe file path
      process.cwd(),
      AVATAR_CONSTANTS.UPLOAD_DIR_REL,
      basename(filename)
    );
    try { // Delete, and log in case of errors (except ENOENT)
      await fs.unlink(safeDiskPath);
    } catch (error: unknown) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        this.logger.warn(`Failed to delete file at ${safeDiskPath}:`, error);
      }
    }
  }

  /** Fn to delete avatar file from disk.
   * Safely deletes an avatar file from the disk.
   * Never deletes default assets or files outside the upload directory.
  */
  private async deleteAvatarFile(avatarUrl: string): Promise<void> {
    // 1. Guard default avatar file
    if (!avatarUrl || avatarUrl === AVATAR_CONSTANTS.DEFAULT_AVATAR_PATH) {
      return;
    }
    // 2. Guard files outside uploads
    if (!avatarUrl.startsWith(`${AVATAR_CONSTANTS.UPLOAD_URL_PREFIX}/`)) {
      return;
    }
    // 3. Remove file safely
    await this.safelyRemoveFileByName(basename(avatarUrl));
  }

  /** Fn to update avatar file for a user.
   * Updates user avatar.
   * Cleans up old custom avatar upon success.
   * Cleans up the newly uploaded file if the user is missing or DB fails.
  */
  async updateAvatar(userId: string, newFilename: string): Promise<UserEntity> {
    // 1. Check if the user exists
    const user = await this.userRepo.findById(userId);
    if (!user) {
      await this.safelyRemoveFileByName(newFilename);
      throw new NotFoundException('User not found');
    }

    // 2. Validate file type by inspecting magic bytes, and clean up if invalid
    const diskPath = join(
      process.cwd(),
      AVATAR_CONSTANTS.UPLOAD_DIR_REL,
      basename(newFilename),
    );
    const isRealAllowedImage = await isValidImageFile(diskPath);
    if (!isRealAllowedImage) {
      await this.safelyRemoveFileByName(newFilename);
      throw new BadRequestException('INVALID_FILE_CONTENT: File is not a valid JPEG, PNG or WebP image');
    }

    const oldAvatar = user.avatar;
    const newAvatarUrl = `${AVATAR_CONSTANTS.UPLOAD_URL_PREFIX}/${newFilename}`;

    // 3. Perform DB update (but roll back if the DB query throws, and re-throw the error)
    let updatedUser: UserEntity | null;
    try {
      updatedUser = await this.userRepo.updateAvatar(userId, newAvatarUrl);
    } catch (error: unknown) {
      await this.safelyRemoveFileByName(newFilename);
      throw error;
    }
  
    // 4. User was soft-deleted or concurrent delete happened: roll back and throw user not found
    if (!updatedUser) {
      await this.safelyRemoveFileByName(newFilename);
      throw new NotFoundException('User not found');
    }
    
    // 5. Clean up old avatar file and return updated user entity
    await this.deleteAvatarFile(oldAvatar);
    return updatedUser;
  }
}
