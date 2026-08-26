import { Injectable } from '@nestjs/common';

// TODO: Replace with real class/interface representing a user entity

// To be done after https://github.com/MarianKijewski/transcendence/issues/2
// and https://github.com/MarianKijewski/transcendence/issues/3 are done.

export type User = any;

@Injectable()
export class UsersService {
  private readonly users = [
    {
      userId: 1,
      email: 'john@42.de',
      password: 'changeme',
    },
    {
      userId: 2,
      email: 'maria@42.fr',
      password: 'guess',
    },
  ];

  async findOne(email: string): Promise<User | undefined> {
    return this.users.find((user) => user.email === email);
  }
}
