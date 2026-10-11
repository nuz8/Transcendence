import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { API_KEY_ACCESS } from '../api-key-access.decorators';
import { API_KEY_HEADER } from '../api-key.constants';
import { ApiKeyService } from '../api-key.service';

interface KeyRequest extends Request {
    user?: unknown;
    apiKeyId?: string;
}

@Injectable()
export class AuthOrApiKeyGuard implements CanActivate {
    constructor(
        private readonly authGuard: AuthGuard,
        private readonly apiKeyService: ApiKeyService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<KeyRequest>();
        const key = request.headers[API_KEY_HEADER];
        if (key === undefined)
            return this.authGuard.canActivate(context);

        const acceptsKey = this.reflector.get<boolean>(API_KEY_ACCESS, context.getHandler());
        const owner = acceptsKey && typeof key === 'string' ? await this.apiKeyService.resolve(key) : null;
        if (!owner)
            throw new UnauthorizedException();

        request.user = { sub: owner.userId };
        request.apiKeyId = owner.keyId;

        return true;
    }
}
