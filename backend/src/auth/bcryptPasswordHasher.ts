import * as bcrypt from 'bcrypt';


export class BcryptPasswordHasher {
  private readonly costFactor = 12;

  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.costFactor);
  }

  async verify(plainPassword: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hash);
  }
}