import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { DenyList } from '../auth/denyList';
import { SocketAuthRegistry } from '../auth/socketAuthRegistry';
import { SocketAuthenticator } from '../auth/socketAuthenticator';
import type { WebSocket } from 'ws';
import { PresenceService } from '../presence';
import { FriendService } from '../friends';
import { EventEmitter } from 'node:events';

function fakeSocket(onClose?: (client: WebSocket) => void): WebSocket {
  const socket = Object.assign(new EventEmitter(), {
    close: jest.fn(),
    ping: jest.fn(),
    terminate: jest.fn(),
    send: jest.fn(),
    readyState: 1,
  });
  socket.terminate.mockImplementation(() => socket.emit('close'));
  if (onClose)
    socket.on('close', () => onClose(socket as unknown as WebSocket));
  return socket as unknown as WebSocket;
}

describe('ChatGateway', () => {
  let jwtService: JwtService;
  let socketAuthRegistry: SocketAuthRegistry;
  let presenceService: PresenceService;
  let friendService: FriendService;
  let gateway: ChatGateway;

  beforeEach(() => {
    jest.useFakeTimers();
    jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    const denyList = new DenyList();
    socketAuthRegistry = new SocketAuthRegistry(denyList);
    presenceService = new PresenceService();
    friendService = {
      listFriends: jest.fn().mockResolvedValue([]),
      onChange: jest.fn(),
    } as unknown as FriendService;
    gateway = new ChatGateway(
      {} as ChatService,
      new SocketAuthenticator(jwtService, denyList, socketAuthRegistry),
      presenceService,
      friendService,
    );
  });

  afterEach(() => {
    socketAuthRegistry.onModuleDestroy();
    jest.useRealTimers();
  });

  async function connectUser(client: WebSocket, userId: string): Promise<void> {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValueOnce({
      sub: userId,
      type: 'access',
      jti: `jti-${userId}`,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    gateway.handleConnection(client);
    await gateway.auth(client, { token: `token-${userId}` });
  }

  describe('presence tracking', () => {
    it('marks the user online once authenticated', async () => {
      await connectUser(fakeSocket(), 'user-1');

      expect(presenceService.isOnline('user-1')).toBe(true);
    });

    it('marks the user offline once disconnected', async () => {
      const client = fakeSocket();
      await connectUser(client, 'user-1');

      gateway.handleDisconnect(client);

      expect(presenceService.isOnline('user-1')).toBe(false);
    });

    it('keeps the user online while another of their sockets is still open', async () => {
      const clientA = fakeSocket();
      const clientB = fakeSocket();
      await connectUser(clientA, 'user-1');
      await connectUser(clientB, 'user-1');

      gateway.handleDisconnect(clientA);

      expect(presenceService.isOnline('user-1')).toBe(true);
    });
  });

  describe('presence broadcast', () => {
    beforeEach(() => {
      (friendService.listFriends as jest.Mock).mockImplementation(async (userId: string) =>
        userId === 'bob' ? [{ friend: { id: 'alice' } }] : [],
      );
    });

    it('notifies an online friend when the other one connects', async () => {
      const aliceClient = fakeSocket();
      await connectUser(aliceClient, 'alice');

      await connectUser(fakeSocket(), 'bob');

      expect(aliceClient.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'presence', data: { userId: 'bob', online: true } }),
      );
    });

    it('notifies friends when a user disconnects', async () => {
      const aliceClient = fakeSocket();
      await connectUser(aliceClient, 'alice');
      const bobClient = fakeSocket();
      await connectUser(bobClient, 'bob');
      (aliceClient.send as jest.Mock).mockClear();

      gateway.handleDisconnect(bobClient);
      await jest.advanceTimersByTimeAsync(0);

      expect(aliceClient.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'presence', data: { userId: 'bob', online: false } }),
      );
    });

    it('does not emit a presence change for an additional socket of an already-online user', async () => {
      const aliceClient = fakeSocket();
      await connectUser(aliceClient, 'alice');
      await connectUser(fakeSocket(), 'bob');
      (aliceClient.send as jest.Mock).mockClear();

      await connectUser(fakeSocket(), 'bob');

      expect(aliceClient.send).not.toHaveBeenCalled();
    });
  });

  describe('friendship change broadcast', () => {
    // The gateway registered its listener in the constructor; grab it from the mock.
    function emitFriendshipChange(change: { kind: string; requesterId: string; addresseeId: string }): void {
      const listener = (friendService.onChange as jest.Mock).mock.calls[0][0];
      listener(change);
    }

    it('tells each party about the other, and nobody else', async () => {
      const aliceClient = fakeSocket();
      const bobClient = fakeSocket();
      const carolClient = fakeSocket();
      await connectUser(aliceClient, 'alice');
      await connectUser(bobClient, 'bob');
      await connectUser(carolClient, 'carol');
      (aliceClient.send as jest.Mock).mockClear();
      (bobClient.send as jest.Mock).mockClear();
      (carolClient.send as jest.Mock).mockClear();

      emitFriendshipChange({ kind: 'requested', requesterId: 'alice', addresseeId: 'bob' });

      expect(aliceClient.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'friendship', data: { kind: 'requested', peerId: 'bob' } }),
      );
      expect(bobClient.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'friendship', data: { kind: 'requested', peerId: 'alice' } }),
      );
      expect(carolClient.send).not.toHaveBeenCalled();
    });

    it('does nothing when neither party is connected', () => {
      expect(() =>
        emitFriendshipChange({ kind: 'removed', requesterId: 'alice', addresseeId: 'bob' }),
      ).not.toThrow();
    });
  });

  describe('presence snapshot on connect', () => {
    it('sends the current online status of all friends right after connecting', async () => {
      (friendService.listFriends as jest.Mock).mockImplementation(async (userId: string) =>
        userId === 'bob'
          ? [{ friend: { id: 'alice' } }, { friend: { id: 'carol' } }]
          : [],
      );
      await connectUser(fakeSocket(), 'alice');

      const bobClient = fakeSocket();
      await connectUser(bobClient, 'bob');

      expect(bobClient.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'presence:snapshot',
          data: [
            { userId: 'alice', online: true },
            { userId: 'carol', online: false },
          ],
        }),
      );
    });

    it('sends an empty snapshot when the user has no friends', async () => {
      const client = fakeSocket();

      await connectUser(client, 'solo');

      expect(client.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'presence:snapshot', data: [] }),
      );
    });
  });

  describe('heartbeat', () => {
    beforeEach(() => gateway.onModuleInit());

    afterEach(() => gateway.onModuleDestroy());

    function socketsFor(userId: string): Set<WebSocket> | undefined {
      return (gateway as unknown as { sockets: Map<string, Set<WebSocket>> }).sockets.get(userId);
    }

    it('pings authenticated sockets once per heartbeat interval', async () => {
      const client = fakeSocket((socket) => gateway.handleDisconnect(socket));
      await connectUser(client, 'user-1');

      jest.advanceTimersByTime(25_000);

      expect(client.ping).toHaveBeenCalledTimes(1);
      expect(client.terminate).not.toHaveBeenCalled();
    });

    it('terminates a socket that misses pong and frees it when close fires', async () => {
      const client = fakeSocket((socket) => gateway.handleDisconnect(socket));
      await connectUser(client, 'user-1');

      jest.advanceTimersByTime(50_000);

      expect(client.ping).toHaveBeenCalledTimes(1);
      expect(client.terminate).toHaveBeenCalledTimes(1);
      expect(socketsFor('user-1')).toBeUndefined();
      expect(presenceService.isOnline('user-1')).toBe(false);
    });

    it('keeps pinging when pong arrives between intervals', async () => {
      const client = fakeSocket((socket) => gateway.handleDisconnect(socket));
      await connectUser(client, 'user-1');

      jest.advanceTimersByTime(25_000);
      client.emit('pong');
      jest.advanceTimersByTime(25_000);

      expect(client.ping).toHaveBeenCalledTimes(2);
      expect(client.terminate).not.toHaveBeenCalled();
      expect(socketsFor('user-1')?.has(client)).toBe(true);
    });
  });
});
