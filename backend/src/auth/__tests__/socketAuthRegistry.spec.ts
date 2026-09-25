import { SocketAuthRegistry, SOCKET_SWEEP_INTERVAL_MS } from '../socketAuthRegistry';
import { DenyList } from '../denyList';
import type { WebSocket } from 'ws';

function fakeSocket(): WebSocket {
  return { close: jest.fn() } as unknown as WebSocket;
}

describe('SocketAuthRegistry', () => {
  let denyList: DenyList;
  let registry: SocketAuthRegistry;

  beforeEach(() => {
    jest.useFakeTimers();
    denyList = new DenyList();
    registry = new SocketAuthRegistry(denyList);
  });

  afterEach(() => {
    registry.onModuleDestroy();
    jest.useRealTimers();
  });

  it('closes a socket once its exp has passed', () => {
    const client = fakeSocket();
    const expiredExp = Math.floor(Date.now() / 1000) - 1;
    registry.register(client, 'jti-1', expiredExp);

    jest.advanceTimersByTime(SOCKET_SWEEP_INTERVAL_MS);

    expect(client.close).toHaveBeenCalledWith(4401, 'unauthorized');
  });

  it('closes a socket whose jti has been revoked', () => {
    const client = fakeSocket();
    const farFutureExp = Math.floor(Date.now() / 1000) + 3600;
    registry.register(client, 'jti-2', farFutureExp);
    denyList.revoke('jti-2', Date.now() + 3600_000);

    jest.advanceTimersByTime(SOCKET_SWEEP_INTERVAL_MS);

    expect(client.close).toHaveBeenCalledWith(4401, 'unauthorized');
  });

  it('leaves a valid, non-revoked socket open', () => {
    const client = fakeSocket();
    const farFutureExp = Math.floor(Date.now() / 1000) + 3600;
    registry.register(client, 'jti-3', farFutureExp);

    jest.advanceTimersByTime(SOCKET_SWEEP_INTERVAL_MS);

    expect(client.close).not.toHaveBeenCalled();
  });

  it('does not close an unrelated socket when another one expires', () => {
    const expired = fakeSocket();
    const stillValid = fakeSocket();
    registry.register(expired, 'jti-4', Math.floor(Date.now() / 1000) - 1);
    registry.register(stillValid, 'jti-5', Math.floor(Date.now() / 1000) + 3600);

    jest.advanceTimersByTime(SOCKET_SWEEP_INTERVAL_MS);

    expect(expired.close).toHaveBeenCalledWith(4401, 'unauthorized');
    expect(stillValid.close).not.toHaveBeenCalled();
  });

  it('stops sweeping once destroyed', () => {
    const client = fakeSocket();
    registry.onModuleDestroy();
    registry.register(client, 'jti-6', Math.floor(Date.now() / 1000) - 1);

    jest.advanceTimersByTime(SOCKET_SWEEP_INTERVAL_MS * 2);

    expect(client.close).not.toHaveBeenCalled();
  });

  it('unregister removes an entry before it can be swept', () => {
    const client = fakeSocket();
    registry.register(client, 'jti-7', Math.floor(Date.now() / 1000) - 1);
    registry.unregister(client);

    jest.advanceTimersByTime(SOCKET_SWEEP_INTERVAL_MS);

    expect(client.close).not.toHaveBeenCalled();
  });
});
