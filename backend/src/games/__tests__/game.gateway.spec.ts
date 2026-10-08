import { JwtService } from '@nestjs/jwt';
import { DenyList } from '../../auth/denyList';
import { GamificationService } from '../../gamification';
import { ScoreEntity, ScoreService } from '../../scores';
import { MatchService } from '../match/match.service';
import { GameGateway, type Session } from '../game.gateway';
import { GameSettingsService } from '../settings/game-settings.service';
import { PresenceService } from '../../presence/presence.service';
import { SocketAuthenticator } from '../../auth/socketAuthenticator';
import { SocketAuthRegistry, SOCKET_SWEEP_INTERVAL_MS } from '../../auth/socketAuthRegistry';
import type { WebSocket } from 'ws';
import { ActiveMatchService } from '../gateway-utils/active-match.service';
import { RoundClock } from '../gateway-utils/round-clock';

class TestGateway extends GameGateway {
  protected readonly gameId: string = 'test-game';
  protected readonly roundTimeLimit = 60_000;

  constructor(
    matchService: MatchService,
    socketAuthenticator: SocketAuthenticator,
    scoreService: ScoreService,
    gamificationService: GamificationService,
    presenceService: PresenceService,
    gameSettingsService = {} as GameSettingsService,
    activeMatchService = new ActiveMatchService(),
  ) {
    super(
      matchService,
      socketAuthenticator,
      scoreService,
      gamificationService,
      gameSettingsService,
      presenceService,
      activeMatchService,
    );
  }

  complete(session: Session, sessionId: string): void {
    this.finish(session, sessionId);
  }
}

class OtherGameGateway extends TestGateway {
  protected readonly gameId: string = 'other-game';
}

describe('GameGateway.finish', () => {
  let gateway: TestGateway;
  let matchService: { matchOutcome: jest.Mock };
  let scoreService: { recordMatch: jest.Mock };
  let gamificationService: { processPvpWin: jest.Mock };

  const session = (withOpponent: boolean): Session => ({
    state: { mode: 'fixed-target-score', target: 2, scoreA: 2, scoreB: 1, forfeitedBy: null, roundsPlayed: 3, powerUps: false, powerUpsLeft: { a: [], b: [] } },
    a: { userId: 'player-a', client: null, dcTimer: null },
    b: withOpponent
      ? { userId: 'player-b', client: null, dcTimer: null }
      : null,
    pending: {},
    clock: new RoundClock(() => undefined),
    pendingPowerUps: {},
  });

  beforeEach(() => {
    matchService = { matchOutcome: jest.fn() };
    scoreService = { recordMatch: jest.fn().mockResolvedValue(undefined) };
    gamificationService = { processPvpWin: jest.fn().mockResolvedValue([]) };
    gateway = new TestGateway(
      matchService as unknown as MatchService,
      {} as SocketAuthenticator,
      scoreService as unknown as ScoreService,
      gamificationService as unknown as GamificationService,
      new PresenceService(),
    );
  });

  it('records both sides of a PvP match and processes only the winner after saving', async () => {
    let persist!: () => void;
    scoreService.recordMatch.mockReturnValue(
      new Promise<void>((resolve) => { persist = resolve; }),
    );
    matchService.matchOutcome.mockImplementation((side: string) =>
      side === 'a' ? 'win' : 'lose',
    );

    gateway.complete(session(true), 'session-id');

    const results = scoreService.recordMatch.mock.calls[0][0] as ScoreEntity[];
    expect(results.map((score) => [score.outcome, score.opponentId])).toEqual([
      ['win', 'player-b'],
      ['lose', 'player-a'],
    ]);
    expect(gamificationService.processPvpWin).not.toHaveBeenCalled();

    persist();
    await Promise.resolve();

    expect(gamificationService.processPvpWin).toHaveBeenCalledTimes(1);
    expect(gamificationService.processPvpWin).toHaveBeenCalledWith('player-a');
  });

  it('records bot matches with no opponent and does not process achievements', async () => {
    matchService.matchOutcome.mockReturnValue('win');

    gateway.complete(session(false), 'bot-session-id');
    await Promise.resolve();

    const results = scoreService.recordMatch.mock.calls[0][0] as ScoreEntity[];
    expect(results).toHaveLength(1);
    expect(results[0].opponentId).toBeNull();
    expect(gamificationService.processPvpWin).not.toHaveBeenCalled();
  });
});

describe('GameGateway - authentication', () => {
  let jwtService: JwtService;
  let socketAuthRegistry: SocketAuthRegistry;
  let presenceService: PresenceService;
  let gateway: TestGateway;

  function fakeSocket(): WebSocket {
    return { close: jest.fn(), send: jest.fn(), readyState: 1 } as unknown as WebSocket;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    const denyList = new DenyList();
    socketAuthRegistry = new SocketAuthRegistry(denyList);
    presenceService = new PresenceService();
    gateway = new TestGateway(
      {} as MatchService,
      new SocketAuthenticator(jwtService, denyList, socketAuthRegistry),
      {} as ScoreService,
      {} as GamificationService,
      presenceService,
    );
  });

  afterEach(() => {
    socketAuthRegistry.onModuleDestroy();
    jest.useRealTimers();
  });

  async function connectUser(client: WebSocket, userId: string, expInSeconds = 3600): Promise<void> {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValueOnce({
      sub: userId,
      type: 'access',
      jti: `jti-${userId}`,
      exp: Math.floor(Date.now() / 1000) + expInSeconds,
    });
    gateway.handleConnection(client);
    await gateway.auth(client, { token: `token-${userId}` });
  }

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

  it('closes a game socket once its access token has expired', async () => {
    const client = fakeSocket();
    await connectUser(client, 'user-1', 1);

    jest.advanceTimersByTime(SOCKET_SWEEP_INTERVAL_MS);

    expect(client.close).toHaveBeenCalledWith(4401, 'unauthorized');
  });

  it('refuses a queue in one game while the same user waits in another', async () => {
    const authenticator = new SocketAuthenticator(jwtService, new DenyList(), socketAuthRegistry);
    const shared = new ActiveMatchService();
    const first = new TestGateway({} as MatchService, authenticator, {} as ScoreService, {} as GamificationService, presenceService, undefined, shared);
    const second = new OtherGameGateway({} as MatchService, authenticator, {} as ScoreService, {} as GamificationService, presenceService, undefined, shared);
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-1', type: 'access', jti: 'jti-1', exp: Math.floor(Date.now() / 1000) + 3600 });
    const socketOne = fakeSocket();
    const socketTwo = fakeSocket();
    first.handleConnection(socketOne);
    await first.auth(socketOne, { token: 'token-1' });
    second.handleConnection(socketTwo);
    await second.auth(socketTwo, { token: 'token-1' });

    await first.queue(socketOne);
    await second.queue(socketTwo);

    expect(socketTwo.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'error', data: { message: 'already in a session', gameId: 'test-game' } }),
    );
  });

  it('tells a user refused in one game which match they are in, in the other', async () => {
    const authenticator = new SocketAuthenticator(jwtService, new DenyList(), socketAuthRegistry);
    const shared = new ActiveMatchService();
    const first = new TestGateway(new MatchService(), authenticator, {} as ScoreService, {} as GamificationService, presenceService, undefined, shared);
    const second = new OtherGameGateway(new MatchService(), authenticator, {} as ScoreService, {} as GamificationService, presenceService, undefined, shared);
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-1', type: 'access', jti: 'jti-1', exp: Math.floor(Date.now() / 1000) + 3600 });
    const socketOne = fakeSocket();
    const socketTwo = fakeSocket();
    first.handleConnection(socketOne);
    await first.auth(socketOne, { token: 'token-1' });
    second.handleConnection(socketTwo);
    await second.auth(socketTwo, { token: 'token-1' });

    await first.create(socketOne);
    const created = (socketOne.send as jest.Mock).mock.calls.map(([raw]) => JSON.parse(raw)).find((m) => m.event === 'created');
    await second.create(socketTwo);

    expect(socketTwo.send).toHaveBeenLastCalledWith(
      JSON.stringify({ event: 'error', data: { message: 'already in a session', sessionId: created.data.sessionId, gameId: 'test-game' } }),
    );
  });

  it('answers quit outside a match with an error', async () => {
    const client = fakeSocket();
    await connectUser(client, 'user-1');

    gateway.quit(client);

    expect(client.send).toHaveBeenLastCalledWith(
      JSON.stringify({ event: 'error', data: { message: 'not in a session' } }),
    );
  });

  describe('GameGateway - matchmaking', () => {
    type Sent = { event: string; data: { sessionId?: string } };
    type Player = { socket: WebSocket; sent: Sent[] };
    type Settings = { target: number; mode: 'fixed-target-score' | 'fixed-rounds'; powerUps: boolean };

    let gateway: TestGateway;
    let matchmakingRegistry: SocketAuthRegistry;
    let levels: Record<string, number>;
    let settings: Record<string, Settings>;

    beforeEach(() => {
      jest.useFakeTimers();
      levels = {};
      settings = {};
      const denyList = new DenyList();
      matchmakingRegistry = new SocketAuthRegistry(denyList);
      const verifyAsync = jest.fn((token: string) => Promise.resolve({
        sub: token,
        type: 'access',
        jti: token,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }));
      gateway = new TestGateway(
        new MatchService(),
        new SocketAuthenticator({ verifyAsync } as unknown as JwtService, denyList, matchmakingRegistry),
        {} as ScoreService,
        { levelOf: jest.fn((userId: string) => Promise.resolve(levels[userId] ?? 0)) } as unknown as GamificationService,
        new PresenceService(),
        { settingsFor: jest.fn((userId: string) => Promise.resolve(settings[userId] ?? null)) } as unknown as GameSettingsService,
      );
      gateway.onModuleInit();
    });

    afterEach(() => {
      gateway.onModuleDestroy();
      matchmakingRegistry.onModuleDestroy();
      jest.useRealTimers();
    });

    async function connect(userId: string): Promise<Player> {
      const sent: Sent[] = [];
      const socket = {
        readyState: 1,
        pause: jest.fn(),
        resume: jest.fn(),
        close: jest.fn(),
        send: (raw: string) => sent.push(JSON.parse(raw) as Sent),
      } as unknown as WebSocket;

      gateway.handleConnection(socket);
      await gateway.auth(socket, { token: userId });
      await gateway.queue(socket);
      return { socket, sent };
    }

    async function queue(userId: string, level: number): Promise<Player> {
      levels[userId] = level;
      const player = await connect(userId);
      await gateway.queue(player.socket);
      return player;
    }

    async function rejoin(userId: string, sessionId: string): Promise<Player> {
      const player = await connect(userId);
      gateway.join(player.socket, sessionId);
      return player;
    }

    const events = (player: Player) => player.sent.map((m) => m.event);
    const joinedOf = (player: Player) => player.sent.find((m) => m.event === 'joined')?.data;
    const sessionOf = (player: Player) => player.sent.find((m) => m.event === 'matched')?.data.sessionId;
    const createdOf = (player: Player) => player.sent.find((m) => m.event === 'created')?.data.sessionId;
    const lastOf = (player: Player) => player.sent[player.sent.length - 1];

    it('pairs players two levels apart, but not three', async () => {
      const a = await queue('a', 0);
      const b = await queue('b', 3);
      expect(sessionOf(a)).toBeUndefined();
      expect(sessionOf(b)).toBeUndefined();

      const c = await queue('c', 5);
      expect(sessionOf(c)).toBe(sessionOf(b));
      expect(sessionOf(a)).toBeUndefined();
    });

    it('pairs the closest level among the waiting players', async () => {
      const a = await queue('a', 0);
      const b = await queue('b', 3);

      const c = await queue('c', 2);
      expect(sessionOf(c)).toBe(sessionOf(b));
      expect(sessionOf(a)).toBeUndefined();
    });

    it('breaks a tie in favour of whoever waited longest', async () => {
      const a = await queue('a', 0);
      const b = await queue('b', 4);

      const c = await queue('c', 2);
      expect(sessionOf(c)).toBe(sessionOf(a));
      expect(sessionOf(b)).toBeUndefined();
    });

    it('pairs any level after 15 seconds of waiting, not before', async () => {
      const a = await queue('a', 0);
      const b = await queue('b', 10);

      await jest.advanceTimersByTimeAsync(10_000);
      expect(sessionOf(a)).toBeUndefined();

      await jest.advanceTimersByTimeAsync(5_000);
      expect(sessionOf(a)).toBeDefined();
      expect(sessionOf(a)).toBe(sessionOf(b));
    });

    it('never pairs different settings, even after widening', async () => {
      settings.a = { target: 3, mode: 'fixed-rounds', powerUps: false };
      const a = await queue('a', 0);
      const b = await queue('b', 0);

      await jest.advanceTimersByTimeAsync(20_000);
      expect(sessionOf(a)).toBeUndefined();
      expect(sessionOf(b)).toBeUndefined();
    });

    it('leaves the queue on request and frees the user to queue again', async () => {
      const a = await queue('a', 0);
      const last = () => a.sent[a.sent.length - 1];

      gateway.leaveQueue(a.socket);
      expect(last().event).toBe('left queue');
      gateway.leaveQueue(a.socket);
      expect(last()).toEqual({ event: 'error', data: { message: 'not in a queue' } });

      const again = await queue('a', 0);
      expect(again.sent[again.sent.length - 1].event).toBe('waiting');
    });

    it('pauses the round clock while a player is away and resumes it with the time left', async () => {
      const a = await queue('a', 0);
      const b = await queue('b', 0);
      expect(b.sent.find((m) => m.event === 'matched')?.data).toMatchObject({ roundTimeLeft: 60_000 });

      await jest.advanceTimersByTimeAsync(50_000);
      gateway.handleDisconnect(a.socket);
      await jest.advanceTimersByTimeAsync(25_000);
      expect(events(b)).not.toContain('cancelled');

      const back = await rejoin('a', sessionOf(a)!);
      expect(joinedOf(back)).toMatchObject({ moved: false, powerUp: null, roundTimeLeft: 10_000 });
      expect(b.sent.find((m) => m.event === 'opponent_reconnected')?.data).toEqual({ roundTimeLeft: 10_000 });

      await jest.advanceTimersByTimeAsync(9_999);
      expect(events(b)).not.toContain('cancelled');
      await jest.advanceTimersByTimeAsync(1);
      expect(b.sent[b.sent.length - 1]).toEqual({ event: 'cancelled', data: { message: 'nobody moved in time' } });
    });

    it('keeps the round clock paused until both players are back', async () => {
      const a = await queue('a', 0);
      const b = await queue('b', 0);
      const sessionId = sessionOf(a)!;

      await jest.advanceTimersByTimeAsync(10_000);
      gateway.handleDisconnect(a.socket);
      await jest.advanceTimersByTimeAsync(5_000);
      gateway.handleDisconnect(b.socket);
      await jest.advanceTimersByTimeAsync(20_000);

      const aBack = await rejoin('a', sessionId);
      expect(joinedOf(aBack)).toMatchObject({ roundTimeLeft: 50_000 });
      await jest.advanceTimersByTimeAsync(9_000);

      const bBack = await rejoin('b', sessionId);
      expect(joinedOf(bBack)).toMatchObject({ roundTimeLeft: 50_000 });
    });

    it('tells a rejoining player which power-up they already chose this round', async () => {
      settings.a = settings.b = { target: 2, mode: 'fixed-target-score', powerUps: true };
      const a = await queue('a', 0);
      await queue('b', 0);

      gateway.powerUp(a.socket, 'double');
      gateway.handleDisconnect(a.socket);
      const back = await rejoin('a', sessionOf(a)!);

      expect(joinedOf(back)).toMatchObject({ moved: false, powerUp: 'double' });
    });

    it('joins the creator to their bot match straight away', async () => {
      const a = await connect('a');
      await gateway.create(a.socket);

      expect(events(a)).toEqual(['authenticated', 'created', 'joined']);
      expect(joinedOf(a)).toMatchObject({ ownScore: 0, opScore: 0, roundsPlayed: 0, roundTimeLeft: null });

      gateway.join(a.socket, createdOf(a));
      expect(lastOf(a)).toEqual({ event: 'error', data: { message: 'session already joined' } });
    });

    it('offers a paired player their match when another tab of theirs queues', async () => {
      const a = await queue('a', 0);
      await queue('b', 0);

      const otherTab = await connect('a');
      await gateway.queue(otherTab.socket);
      expect(lastOf(otherTab)).toEqual({ event: 'error', data: { message: 'already in a session', sessionId: sessionOf(a), gameId: 'test-game' } });
    });

    it('holds a bot match for the reconnect window after its tab closes, then frees the user', async () => {
      const a = await connect('a');
      await gateway.create(a.socket);
      const sessionId = createdOf(a)!;
      gateway.handleDisconnect(a.socket);

      await jest.advanceTimersByTimeAsync(29_999);
      const otherTab = await connect('a');
      await gateway.queue(otherTab.socket);
      expect(lastOf(otherTab)).toEqual({ event: 'error', data: { message: 'already in a session', sessionId, gameId: 'test-game' } });

      await jest.advanceTimersByTimeAsync(1);
      await gateway.queue(otherTab.socket);
      expect(lastOf(otherTab).event).toBe('waiting');
    });
  });
});
