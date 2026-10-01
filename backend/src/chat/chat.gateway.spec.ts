import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { DenyList } from '../auth/denyList';
import { SocketAuthRegistry, SOCKET_SWEEP_INTERVAL_MS } from '../auth/socketAuthRegistry';
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { PresenceService } from '../presence';
import { FriendService } from '../friends';


function fakeSocket(): WebSocket {
  return { pause: jest.fn(), resume: jest.fn(), close: jest.fn(), send: jest.fn(), readyState: 1 } as unknown as WebSocket;
}

function fakeRequest(token: string): IncomingMessage {
  return { headers: { authorization: `Bearer ${token}` } } as unknown as IncomingMessage;
}

describe('ChatGateway - socket auth revalidation', () => {
  let jwtService: JwtService;
  let denyList: DenyList;
  let socketAuthRegistry: SocketAuthRegistry;
  let presenceService: PresenceService;
  let friendService: FriendService;
  let gateway: ChatGateway;

  beforeEach(() => {
    jest.useFakeTimers();
    jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    denyList = new DenyList();
    socketAuthRegistry = new SocketAuthRegistry(denyList);
    presenceService = new PresenceService();
    friendService = { listFriends: jest.fn().mockResolvedValue([]) } as unknown as FriendService;
    gateway = new ChatGateway({} as ChatService, jwtService, denyList, socketAuthRegistry, presenceService, friendService);
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

describe('ChatGateway - presence tracking', () => {
  let jwtService: JwtService;
  let denyList: DenyList;
  let socketAuthRegistry: SocketAuthRegistry;
  let presenceService: PresenceService;
  let friendService: FriendService;
  let gateway: ChatGateway;

  beforeEach(() => {
    jest.useFakeTimers();
    jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    denyList = new DenyList();
    socketAuthRegistry = new SocketAuthRegistry(denyList);
    presenceService = new PresenceService();
    friendService = { listFriends: jest.fn().mockResolvedValue([]) } as unknown as FriendService;
    gateway = new ChatGateway({} as ChatService, jwtService, denyList, socketAuthRegistry, presenceService, friendService);
  });

  afterEach(() => {
    socketAuthRegistry.onModuleDestroy();
    jest.useRealTimers();
  });

  it('marks the user online once authenticated', async () => {
    const client = fakeSocket();
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'user-1',
      type: 'access',
      jti: 'jti-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    gateway.handleConnection(client, fakeRequest('token'));
    await jest.advanceTimersByTimeAsync(0);

    expect(presenceService.isOnline('user-1')).toBe(true);
  });

  it('marks the user offline once disconnected', async () => {
    const client = fakeSocket();
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'user-1',
      type: 'access',
      jti: 'jti-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    gateway.handleConnection(client, fakeRequest('token'));
    await jest.advanceTimersByTimeAsync(0);

    gateway.handleDisconnect(client);

    expect(presenceService.isOnline('user-1')).toBe(false);
  });

  it('keeps the user online while another of their sockets is still open', async () => {
    const clientA = fakeSocket();
    const clientB = fakeSocket();
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'user-1',
      type: 'access',
      jti: 'jti-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    gateway.handleConnection(clientA, fakeRequest('token-a'));
    gateway.handleConnection(clientB, fakeRequest('token-b'));
    await jest.advanceTimersByTimeAsync(0);

    gateway.handleDisconnect(clientA);

    expect(presenceService.isOnline('user-1')).toBe(true);
  });
});

describe('ChatGateway - presence broadcast', () => {
  let jwtService: JwtService;
  let denyList: DenyList;
  let socketAuthRegistry: SocketAuthRegistry;
  let presenceService: PresenceService;
  let friendService: FriendService;
  let gateway: ChatGateway;

  beforeEach(() => {
    jest.useFakeTimers();
    jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    denyList = new DenyList();
    socketAuthRegistry = new SocketAuthRegistry(denyList);
    presenceService = new PresenceService();
    friendService = { listFriends: jest.fn() } as unknown as FriendService;
    gateway = new ChatGateway({} as ChatService, jwtService, denyList, socketAuthRegistry, presenceService, friendService);
  });

  afterEach(() => {
    socketAuthRegistry.onModuleDestroy();
    jest.useRealTimers();
  });

  async function connectUser(client: WebSocket, userId: string, token: string): Promise<void> {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValueOnce({
      sub: userId,
      type: 'access',
      jti: `jti-${userId}`,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    gateway.handleConnection(client, fakeRequest(token));
    await jest.advanceTimersByTimeAsync(0);
  }

  it('notifies an online friend when the other one connects', async () => {
    (friendService.listFriends as jest.Mock).mockImplementation(async (userId: string) =>
      userId === 'bob' ? [{ friend: { id: 'alice' } }] : [],
    );

    const aliceClient = fakeSocket();
    await connectUser(aliceClient, 'alice', 'token-alice');

    const bobClient = fakeSocket();
    await connectUser(bobClient, 'bob', 'token-bob');

    expect(aliceClient.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'presence', data: { userId: 'bob', online: true } }),
    );
  });

  it('notifies friends when a user disconnects', async () => {
    (friendService.listFriends as jest.Mock).mockImplementation(async (userId: string) =>
      userId === 'bob' ? [{ friend: { id: 'alice' } }] : [],
    );

    const aliceClient = fakeSocket();
    await connectUser(aliceClient, 'alice', 'token-alice');
    const bobClient = fakeSocket();
    await connectUser(bobClient, 'bob', 'token-bob');
    (aliceClient.send as jest.Mock).mockClear();

    gateway.handleDisconnect(bobClient);
    await jest.advanceTimersByTimeAsync(0);

    expect(aliceClient.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'presence', data: { userId: 'bob', online: false } }),
    );
  });

  it('does not emit a presence change for an additional socket of an already-online user', async () => {
    (friendService.listFriends as jest.Mock).mockImplementation(async (userId: string) =>
      userId === 'bob' ? [{ friend: { id: 'alice' } }] : [],
    );

    const aliceClient = fakeSocket();
    await connectUser(aliceClient, 'alice', 'token-alice');
    const bobClientA = fakeSocket();
    await connectUser(bobClientA, 'bob', 'token-bob-a');
    (aliceClient.send as jest.Mock).mockClear();

    const bobClientB = fakeSocket();
    await connectUser(bobClientB, 'bob', 'token-bob-b');

    expect(aliceClient.send).not.toHaveBeenCalled();
  });
});

describe('ChatGateway - disconnect during authentication', () => {
  let jwtService: JwtService;
  let denyList: DenyList;
  let socketAuthRegistry: SocketAuthRegistry;
  let presenceService: PresenceService;
  let friendService: FriendService;
  let gateway: ChatGateway;

  beforeEach(() => {
    jest.useFakeTimers();
    jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    denyList = new DenyList();
    socketAuthRegistry = new SocketAuthRegistry(denyList);
    presenceService = new PresenceService();
    friendService = { listFriends: jest.fn().mockResolvedValue([]) } as unknown as FriendService;
    gateway = new ChatGateway({} as ChatService, jwtService, denyList, socketAuthRegistry, presenceService, friendService);
  });

  afterEach(() => {
    socketAuthRegistry.onModuleDestroy();
    jest.useRealTimers();
  });

  it('does not register a socket that closed while verifyAsync was still pending', async () => {
    const client = fakeSocket();
    let resolveVerify!: (payload: unknown) => void;
    (jwtService.verifyAsync as jest.Mock).mockImplementation(
      () => new Promise((resolve) => { resolveVerify = resolve; }),
    );

    gateway.handleConnection(client, fakeRequest('token'));
    (client as unknown as { readyState: number }).readyState = 3; // WebSocket.CLOSED
    resolveVerify({ sub: 'user-1', type: 'access', jti: 'jti-1', exp: Math.floor(Date.now() / 1000) + 3600 });
    await jest.advanceTimersByTimeAsync(0);

    expect(presenceService.isOnline('user-1')).toBe(false);
    expect(client.resume).not.toHaveBeenCalled();
  });
});

describe('ChatGateway - presence snapshot on connect', () => {
  let jwtService: JwtService;
  let denyList: DenyList;
  let socketAuthRegistry: SocketAuthRegistry;
  let presenceService: PresenceService;
  let friendService: FriendService;
  let gateway: ChatGateway;

  beforeEach(() => {
    jest.useFakeTimers();
    jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    denyList = new DenyList();
    socketAuthRegistry = new SocketAuthRegistry(denyList);
    presenceService = new PresenceService();
    friendService = { listFriends: jest.fn() } as unknown as FriendService;
    gateway = new ChatGateway({} as ChatService, jwtService, denyList, socketAuthRegistry, presenceService, friendService);
  });

  afterEach(() => {
    socketAuthRegistry.onModuleDestroy();
    jest.useRealTimers();
  });

  async function connectUser(client: WebSocket, userId: string, token: string): Promise<void> {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValueOnce({
      sub: userId,
      type: 'access',
      jti: `jti-${userId}`,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    gateway.handleConnection(client, fakeRequest(token));
    await jest.advanceTimersByTimeAsync(0);
  }

  it('sends the current online status of all friends right after connecting', async () => {
    (friendService.listFriends as jest.Mock).mockImplementation(async (userId: string) =>
      userId === 'bob'
        ? [{ friend: { id: 'alice' } }, { friend: { id: 'carol' } }]
        : [],
    );

    const aliceClient = fakeSocket();
    await connectUser(aliceClient, 'alice', 'token-alice');

    const bobClient = fakeSocket();
    await connectUser(bobClient, 'bob', 'token-bob');

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
    (friendService.listFriends as jest.Mock).mockResolvedValue([]);
    const client = fakeSocket();

    await connectUser(client, 'solo', 'token-solo');

    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'presence:snapshot', data: [] }),
    );
  });
});
