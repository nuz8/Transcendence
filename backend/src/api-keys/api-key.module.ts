import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyRepository } from './api-key.repository';
import { ApiKeyService } from './api-key.service';
import { AuthOrApiKeyGuard } from './guards/auth-or-api-key.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { API_KEY_RATE_LIMIT } from './api-key.constants';
import { ApiKeyThrottlerGuard } from './guards/api-key-throttle.guard';

@Module({
    imports: [AuthModule, ThrottlerModule.forRoot([API_KEY_RATE_LIMIT])],
    controllers: [ApiKeyController],
    providers: [ApiKeyRepository, ApiKeyService, AuthOrApiKeyGuard, ApiKeyThrottlerGuard],
    exports: [ApiKeyService, AuthOrApiKeyGuard, ApiKeyThrottlerGuard],
})
export class ApiKeyModule { }
