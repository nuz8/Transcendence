import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ApiKeyService } from '../api-key.service';
import { AuthOrApiKeyGuard } from '../guards/auth-or-api-key.guard';

function context(request: Record<string, unknown>): ExecutionContext {
	return {
		switchToHttp: () => ({ getRequest: () => request }),
		getHandler: () => function handler() {},
	} as unknown as ExecutionContext;
}

describe('AuthOrApiKeyGuard', () => {
	let authGuard: { canActivate: jest.Mock };
	let apiKeyService: { resolve: jest.Mock };
	let reflector: { get: jest.Mock };
	let guard: AuthOrApiKeyGuard;

	beforeEach(() => {
		authGuard = { canActivate: jest.fn().mockResolvedValue(true) };
		apiKeyService = { resolve: jest.fn() };
		reflector = { get: jest.fn().mockReturnValue(true) };
		guard = new AuthOrApiKeyGuard(authGuard as unknown as AuthGuard, apiKeyService as unknown as ApiKeyService, reflector as unknown as Reflector);
	});

	it('hands requests without a key to the login-token guard', async () => {
		const ctx = context({ headers: { authorization: 'Bearer abc' } });

		await expect(guard.canActivate(ctx)).resolves.toBe(true);
		expect(authGuard.canActivate).toHaveBeenCalledWith(ctx);
		expect(apiKeyService.resolve).not.toHaveBeenCalled();
	});

	it('accepts a valid key on a route that allows keys and acts as the key owner', async () => {
		apiKeyService.resolve.mockResolvedValue({ keyId: 'key-1', userId: 'user-1' });
		const request: Record<string, unknown> = { headers: { 'x-api-key': 'tk_good' } };

		await expect(guard.canActivate(context(request))).resolves.toBe(true);
		expect(request.user).toEqual({ sub: 'user-1' });
		expect(request.apiKeyId).toBe('key-1');
		expect(authGuard.canActivate).not.toHaveBeenCalled();
	});

	it('rejects a key on a route that does not allow keys, without looking it up', async () => {
		reflector.get.mockReturnValue(undefined);

		await expect(guard.canActivate(context({ headers: { 'x-api-key': 'tk_good' } }))).rejects.toThrow(UnauthorizedException);
		expect(apiKeyService.resolve).not.toHaveBeenCalled();
	});

	it('rejects an unknown key, even when a login token is also sent', async () => {
		apiKeyService.resolve.mockResolvedValue(null);

		await expect(
			guard.canActivate(context({ headers: { 'x-api-key': 'tk_bad', authorization: 'Bearer abc' } })),
		).rejects.toThrow(UnauthorizedException);
		expect(authGuard.canActivate).not.toHaveBeenCalled();
	});

	it('rejects a repeated key header', async () => {
		await expect(guard.canActivate(context({ headers: { 'x-api-key': ['tk_a', 'tk_b'] } }))).rejects.toThrow(UnauthorizedException);
		expect(apiKeyService.resolve).not.toHaveBeenCalled();
	});
});
