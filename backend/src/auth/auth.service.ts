import { UserRepository } from './userRepository';
import { BcryptPasswordHasher } from './bcryptPasswordHasher';
import { AuthResult, toPublicUser } from './types';

export class AuthService {
    constructor(
        private readonly userRepo: UserRepository,
        private readonly hasher: BcryptPasswordHasher
    ) {}

    async authenticate(email: string, password: string): Promise<AuthResult> {

        const user = await this.userRepo.findByEmail(email);

        if (!user) {
            return { success: false, reason: 'INVALID_CREDENTIALS'};
        }

        const isValid = await this.hasher.verify(password, user.passwordHash);

        if (!isValid) {
            return { success: false, reason: 'INVALID_CREDENTIALS'};
        }

        return { success: true, user: toPublicUser(user) };
    }
}