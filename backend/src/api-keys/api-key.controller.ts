import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ApiKeyService } from './api-key.service';
import { ApiApiKeysController, ApiDeleteApiKey, ApiGetApiKeys, ApiPostApiKey } from './api-key-api.decorators';
import { ApiKeyResponseDto, CreatedApiKeyResponseDto } from './dto/api-key-response.dto';

interface AuthenticatedRequest {
    user: { sub: string };
}

@ApiApiKeysController()
@Controller('users/self/api-keys')
@UseGuards(AuthGuard)
export class ApiKeyController {
    constructor(private readonly apiKeyService: ApiKeyService) { }

    @Post()
    @ApiPostApiKey()
    create(@Req() req: AuthenticatedRequest): Promise<CreatedApiKeyResponseDto> {
        return this.apiKeyService.create(req.user.sub);
    }

    @Get()
    @ApiGetApiKeys()
    list(@Req() req: AuthenticatedRequest): Promise<ApiKeyResponseDto[]> {
        return this.apiKeyService.list(req.user.sub);
    }

    @Delete(':id')
    @ApiDeleteApiKey()
    @HttpCode(HttpStatus.NO_CONTENT)
    revoke(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
        return this.apiKeyService.revoke(req.user.sub, id);
    }
}
