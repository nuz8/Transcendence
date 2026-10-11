import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { API_KEY_HEADER } from '../api-key.constants';

@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
    protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
        return context.switchToHttp().getRequest().headers[API_KEY_HEADER] === undefined;
    }

    protected async getTracker(req: Record<string, any>): Promise<string> {
        return req.apiKeyId;
    }

    protected generateKey(_context: ExecutionContext, tracker: string, throttlerName: string): string {
        return `${throttlerName}-${tracker}`;
    }
}
