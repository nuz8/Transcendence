import { UserRepository } from './userRepository';
import { BcryptPasswordHasher } from './bcryptPasswordHasher';
import { AuthResult, RefreshResult, toPublicUser } from './types';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { AllowList } from './allowList';


export class AuthService {
    constructor(
        private readonly userRepo: UserRepository,
        private readonly hasher: BcryptPasswordHasher,
        private readonly jwtService: JwtService,
        private readonly allowList: AllowList
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

        const access_token = await this.jwtService.signAsync({ sub: user.id, type: 'access', jti: randomUUID() });
        const refreshJti = randomUUID();
        const refresh_token = await this.jwtService.signAsync({ sub: user.id, type: 'refresh', jti: refreshJti }, { expiresIn: '7d' }, );
        const { exp } = this.jwtService.decode(refresh_token) as { exp: number };
        this.allowList.add(refreshJti, exp * 1000);

        return { success: true, user: toPublicUser(user), access_token, refresh_token };
    }

    async refresh(refreshToken: string): Promise<RefreshResult> {
        try {
            const payload = await this.jwtService.verifyAsync(refreshToken);

            if (payload.type !== 'refresh') {
                return { success: false, reason: 'INVALID_REFRESH_TOKEN' };
            }

            if (!this.allowList.isValid(payload.jti)) {
                return { success: false, reason: 'INVALID_REFRESH_TOKEN' };
            }

            const access_token = await this.jwtService.signAsync({ sub: payload.sub, type: 'access', jti: randomUUID() });

            const newRefreshJti = randomUUID();
            const refresh_token = await this.jwtService.signAsync(
                { sub: payload.sub, type: 'refresh', jti: newRefreshJti },
                { expiresIn: '7d' },
            );
            const { exp } = this.jwtService.decode(refresh_token) as { exp: number };
            this.allowList.remove(payload.jti);
            this.allowList.add(newRefreshJti, exp * 1000);

            return { success: true, access_token, refresh_token };

        } catch {
            return { success: false, reason: 'INVALID_REFRESH_TOKEN' };
        }
    }

}