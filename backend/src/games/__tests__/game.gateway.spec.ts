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

class TestGateway extends GameGateway {
  protected readonly gameId = 'test-game';
  protected readonly roundTimeLimit = 60_000;

  constructor(
    matchService: MatchService,
    socketAuthenticator: SocketAuthenticator,
    scoreService: ScoreService,
    gamificationService: GamificationService,
    presenceService: PresenceService,
    gameSettingsService = {} as GameSettingsService,
  ) {
    super(
      matchService,
      socketAuthenticator,
      scoreService,
      gamificationService,
      gameSettingsService,
      presenceService,
    );
  }

  complete(session: Session, sessionId: string): void {
    this.finish(session, sessionId);
  }
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
    roundTimer: null,
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

    async function queue(userId: string, level: number): Promise<Player> {
      levels[userId] = level;
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

    const sessionOf = (player: Player) => player.sent.find((m) => m.event === 'matched')?.data.sessionId;

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
  });
});
