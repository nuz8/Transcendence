import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../guards/auth.guard';
import { DenyList } from '../denyList';


function createMockContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const denyList = new DenyList();
  const guard = new AuthGuard(jwtService, denyList);


  it('allows access with a valid token and attaches the payload to the request', async () => {
    const token = await jwtService.signAsync({ sub: '1', type: 'access' });
    const request = { headers: { authorization: `Bearer ${token}` } };

    const result = await guard.canActivate(createMockContext(request));

    expect(result).toBe(true);
    expect((request as any).user).toMatchObject({ sub: '1' });
  });

  it('rejects a request with no Authorization header', async () => {
    const request = { headers: {} };

    await expect(guard.canActivate(createMockContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a malformed Authorization header', async () => {
    const request = { headers: { authorization: 'Basic abc123' } };

    await expect(guard.canActivate(createMockContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const request = { headers: { authorization: 'Bearer not-a-real-token' } };

    await expect(guard.canActivate(createMockContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const token = await jwtService.signAsync({ sub: '1', type: 'access' }, { expiresIn: -1 });
    const request = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(createMockContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a refresh token used as an access token', async () => {
    const token = await jwtService.signAsync({ sub: '1', type: 'refresh' });
    const request = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(createMockContext(request))).rejects.toThrow(UnauthorizedException);
  });
  
  it('rejects a token whose jti has been revoked', async () => {
    const token = await jwtService.signAsync({ sub: '1', type: 'access', jti: 'revoked-id' });
    denyList.revoke('revoked-id', Date.now() + 60_000);
    const request = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(createMockContext(request))).rejects.toThrow(UnauthorizedException);
  });

});
