import { UserRepository } from './userRepository';
import { BcryptPasswordHasher } from './bcryptPasswordHasher';
import { AuthResult, RefreshResult, toPublicUser } from './types';
import { JwtService } from '@nestjs/jwt';

export class AuthService {
    constructor(
        private readonly userRepo: UserRepository,
        private readonly hasher: BcryptPasswordHasher,
        private readonly jwtService: JwtService
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

        const access_token = await this.jwtService.signAsync({ sub: user.id, type: 'access' });
        const refresh_token = await this.jwtService.signAsync({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });


        return { success: true, user: toPublicUser(user), access_token, refresh_token };
    }

    async refresh(refreshToken: string): Promise<RefreshResult> {
        try {
            const payload = await this.jwtService.verifyAsync(refreshToken);

            if (payload.type !== 'refresh') {
                return { success: false, reason: 'INVALID_REFRESH_TOKEN' };
            }

            const access_token = await this.jwtService.signAsync({ sub: payload.sub, type: 'access' });
            return { success: true, access_token };
        } catch {
            return { success: false, reason: 'INVALID_REFRESH_TOKEN' };
        }
    }

}