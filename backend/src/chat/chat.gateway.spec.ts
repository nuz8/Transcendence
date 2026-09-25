import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { DenyList } from '../auth/denyList';
import { SocketAuthRegistry, SOCKET_SWEEP_INTERVAL_MS } from '../auth/socketAuthRegistry';
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

function fakeSocket(): WebSocket {
  return { pause: jest.fn(), resume: jest.fn(), close: jest.fn() } as unknown as WebSocket;
}

function fakeRequest(token: string): IncomingMessage {
  return { headers: { authorization: `Bearer ${token}` } } as unknown as IncomingMessage;
}

describe('ChatGateway - socket auth revalidation', () => {
  let jwtService: JwtService;
  let denyList: DenyList;
  let socketAuthRegistry: SocketAuthRegistry;
  let gateway: ChatGateway;

  beforeEach(() => {
    jest.useFakeTimers();
    jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    denyList = new DenyList();
    socketAuthRegistry = new SocketAuthRegistry(denyList);
    gateway = new ChatGateway({} as ChatService, jwtService, denyList, socketAuthRegistry);
  });

  afterEach(() => {
    socketAuthRegistry.onModuleDestroy();
    jest.useRealTimers();
  });

  it('closes the socket once its access token has expired', async () => {
    const client = fakeSocket();
    const exp = Math.floor(Date.now() / 1000) + 1;
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-1', type: 'access', jti: 'jti-1', exp });

    gateway.handleConnection(client, fakeRequest('token'));
    await jest.advanceTimersByTimeAsync(0);
    expect(client.close).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(SOCKET_SWEEP_INTERVAL_MS);

    expect(client.close).toHaveBeenCalledWith(4401, 'unauthorized');
  });

  it('closes the socket once the access token is revoked (logout)', async () => {
    const client = fakeSocket();
    const exp = Math.floor(Date.now() / 1000) + 3600;
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-1', type: 'access', jti: 'jti-2', exp });

    gateway.handleConnection(client, fakeRequest('token'));
    await jest.advanceTimersByTimeAsync(0);

    denyList.revoke('jti-2', Date.now() + 3600_000); // ce que AuthController.logout() fait déjà

    await jest.advanceTimersByTimeAsync(SOCKET_SWEEP_INTERVAL_MS);

    expect(client.close).toHaveBeenCalledWith(4401, 'unauthorized');
  });

  it('leaves an unrelated socket open when another user expires or is logged out', async () => {
    const expiredClient = fakeSocket();
    const otherClient = fakeSocket();
    const now = Math.floor(Date.now() / 1000);
    (jwtService.verifyAsync as jest.Mock)
      .mockResolvedValueOnce({ sub: 'user-1', type: 'access', jti: 'jti-3', exp: now - 1 })
      .mockResolvedValueOnce({ sub: 'user-2', type: 'access', jti: 'jti-4', exp: now + 3600 });

    gateway.handleConnection(expiredClient, fakeRequest('token-1'));
    gateway.handleConnection(otherClient, fakeRequest('token-2'));
    await jest.advanceTimersByTimeAsync(0);

    await jest.advanceTimersByTimeAsync(SOCKET_SWEEP_INTERVAL_MS);

    expect(expiredClient.close).toHaveBeenCalledWith(4401, 'unauthorized');
    expect(otherClient.close).not.toHaveBeenCalled();
  });
});
