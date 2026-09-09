import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { UserEntity } from './user.entity';

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) { }

  async findByUsername(email: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findByUsername(email);
    if (!user) {
      return null;
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      return null;
    }
    return user;
  }

  async createUser(
    username: string,
    email: string,
    passwordHash: string
  ): Promise<UserEntity> {
    return await this.userRepo.createUser(username, email, passwordHash);
  }
}
