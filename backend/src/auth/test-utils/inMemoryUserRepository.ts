import { UserRepository } from '../userRepository';
import { User } from '../types';

export class InMemoryUserRepository implements UserRepository {
  constructor(private users: User[] = []) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(u => u.email === email) ?? null;
  }
}