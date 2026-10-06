import { JwtService } from '@nestjs/jwt';
import type { WebSocket } from 'ws';
import { DenyList } from '../denyList';
import { SocketAuthRegistry, SOCKET_SWEEP_INTERVAL_MS } from '../socketAuthRegistry';
import { SocketAuthenticator, AUTH_GRACE_PERIOD_MS } from '../socketAuthenticator';

function fakeSocket(): WebSocket {
  return { close: jest.fn(), send: jest.fn(), readyState: 1 } as unknown as WebSocket;
}

function accessPayload(sub: string, jti: string, expInSeconds = 3600) {
  return { sub, type: 'access', jti, exp: Math.floor(Date.now() / 1000) + expInSeconds };
}

describe('SocketAuthenticator', () => {
  let jwtService: JwtService;
  let denyList: DenyList;
  let registry: SocketAuthRegistry;
  let authenticator: SocketAuthenticator;
  let onFirstAuth: jest.Mock;
  let client: WebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    denyList = new DenyList();
    registry = new SocketAuthRegistry(denyList);
    authenticator = new SocketAuthenticator(jwtService, denyList, registry);
    onFirstAuth = jest.fn();
    client = fakeSocket();
  });

  afterEach(() => {
    registry.onModuleDestroy();
    jest.useRealTimers();
  });

  function verifyReturns(...payloads: object[]): void {
    for (const payload of payloads)
      (jwtService.verifyAsync as jest.Mock).mockResolvedValueOnce(payload);
  }

  async function connect(token = 'token'): Promise<void> {
    authenticator.begin(client);
    await authenticator.authenticate(client, { token }, onFirstAuth);
  }

  describe('grace period', () => {
    it('closes the socket when no auth message arrives in time', () => {
      authenticator.begin(client);
      jest.advanceTimersByTime(AUTH_GRACE_PERIOD_MS);

      expect(client.close).toHaveBeenCalledWith(4401, 'auth timeout');
    });

    it('keeps the socket open when auth arrives in time', async () => {
      verifyReturns(accessPayload('user-1', 'jti-1'));

      authenticator.begin(client);
      jest.advanceTimersByTime(AUTH_GRACE_PERIOD_MS - 1000);
      await authenticator.authenticate(client, { token: 'token' }, onFirstAuth);
      jest.advanceTimersByTime(1000);

      expect(client.close).not.toHaveBeenCalled();
    });
  });

  describe('token checks', () => {
    it('rejects a message without a token before verifying anything', async () => {
      authenticator.begin(client);
      await authenticator.authenticate(client, {}, onFirstAuth);

      expect(client.close).toHaveBeenCalledWith(4401, 'unauthorized');
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('rejects an invalid token', async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValueOnce(new Error('invalid'));

      await connect();

      expect(client.close).toHaveBeenCalledWith(4401, 'unauthorized');
    });

    it('rejects a token that is not an access token', async () => {
      verifyReturns({ ...accessPayload('user-1', 'jti-1'), type: 'refresh' });

      await connect();

      expect(client.close).toHaveBeenCalledWith(4401, 'unauthorized');
    });

    it('rejects a revoked token', async () => {
      denyList.revoke('jti-1', Date.now() + 3600_000);
      verifyReturns(accessPayload('user-1', 'jti-1'));

      await connect();

      expect(client.close).toHaveBeenCalledWith(4401, 'unauthorized');
    });

    it('does not register a socket that closed while the token was being verified', async () => {
      let resolveVerify!: (payload: unknown) => void;
      (jwtService.verifyAsync as jest.Mock).mockImplementationOnce(
        () => new Promise((resolve) => { resolveVerify = resolve; }),
      );

      authenticator.begin(client);
      const pending = authenticator.authenticate(client, { token: 'token' }, onFirstAuth);
      (client as unknown as { readyState: number }).readyState = 3; // WebSocket.CLOSED
      resolveVerify(accessPayload('user-1', 'jti-1'));
      await pending;

      expect(onFirstAuth).not.toHaveBeenCalled();
      expect(client.send).not.toHaveBeenCalled();
    });
  });

  describe('first auth', () => {
    it('records the user, runs onFirstAuth, and only then acknowledges the client', async () => {
      verifyReturns(accessPayload('user-1', 'jti-1'));

      await connect();

      expect(authenticator.userOf(client)).toBe('user-1');
      expect(onFirstAuth).toHaveBeenCalledWith('user-1');
      expect(client.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'authenticated', data: { userId: 'user-1' } }),
      );
      expect(onFirstAuth.mock.invocationCallOrder[0])
        .toBeLessThan((client.send as jest.Mock).mock.invocationCallOrder[0]);
    });
  });

  describe('renewal', () => {
    it('extends the expiry without running onFirstAuth again', async () => {
      verifyReturns(accessPayload('user-1', 'jti-old', 1), accessPayload('user-1', 'jti-new'));

      await connect('old-token');
      await authenticator.authenticate(client, { token: 'new-token' }, onFirstAuth);
      jest.advanceTimersByTime(SOCKET_SWEEP_INTERVAL_MS);

      expect(client.close).not.toHaveBeenCalled();
      expect(onFirstAuth).toHaveBeenCalledTimes(1);
      expect(client.send).toHaveBeenCalledTimes(1);
    });

    it('closes the socket when the new token belongs to another user', async () => {
      verifyReturns(accessPayload('user-1', 'jti-1'), accessPayload('user-2', 'jti-2'));

      await connect('token-user-1');
      await authenticator.authenticate(client, { token: 'token-user-2' }, onFirstAuth);

      expect(client.close).toHaveBeenCalledWith(4401, 'unauthorized');
      expect(authenticator.userOf(client)).toBe('user-1');
    });

    it('closes the socket when the new token is revoked', async () => {
      verifyReturns(accessPayload('user-1', 'jti-1'), accessPayload('user-1', 'jti-2'));

      await connect('token-1');
      denyList.revoke('jti-2', Date.now() + 3600_000);
      await authenticator.authenticate(client, { token: 'token-2' }, onFirstAuth);

      expect(client.close).toHaveBeenCalledWith(4401, 'unauthorized');
    });
  });

  describe('release', () => {
    it('forgets the socket and stops watching its token', async () => {
      verifyReturns(accessPayload('user-1', 'jti-1', 1));
      await connect();

      expect(authenticator.release(client)).toBe('user-1');
      expect(authenticator.userOf(client)).toBeUndefined();

      jest.advanceTimersByTime(SOCKET_SWEEP_INTERVAL_MS);
      expect(client.close).not.toHaveBeenCalled();
    });
  });
});
