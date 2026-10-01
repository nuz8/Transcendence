import { JwtService } from '@nestjs/jwt';
import { DenyList } from '../../auth/denyList';
import { GamificationService } from '../../gamification';
import { ScoreRepository, type ScoreWithXp } from '../../scores';
import { MatchService } from '../match/match.service';
import { GameGateway, type Session } from '../game.gateway';
import { PresenceService } from '../../presence/presence.service';
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

class TestGateway extends GameGateway {
  protected readonly gameId = 'test-game';
  protected readonly bestOf = 3;
  protected readonly roundTimeLimit = 60_000;

  constructor(
    matchService: MatchService,
    jwtService: JwtService,
    denyList: DenyList,
    scoreRepository: ScoreRepository,
    gamificationService: GamificationService,
    presenceService: PresenceService,
  ) {
    super(
      matchService,
      jwtService,
      denyList,
      scoreRepository,
      gamificationService,
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
  let scoreRepository: { recordMatch: jest.Mock };
  let gamificationService: { processPvpWin: jest.Mock };

  const session = (withOpponent: boolean): Session => ({
    state: { targetRounds: 2, scoreA: 2, scoreB: 1, forfeitedBy: null },
    a: { userId: 'player-a', client: null, dcTimer: null },
    b: withOpponent
      ? { userId: 'player-b', client: null, dcTimer: null }
      : null,
    roundsPlayed: 3,
    pending: {},
    roundTimer: null,
  });

  beforeEach(() => {
    matchService = { matchOutcome: jest.fn() };
    scoreRepository = { recordMatch: jest.fn().mockResolvedValue(undefined) };
    gamificationService = { processPvpWin: jest.fn().mockResolvedValue([]) };
      gateway = new TestGateway(
      matchService as unknown as MatchService,
      {} as JwtService,
      {} as DenyList,
      scoreRepository as unknown as ScoreRepository,
      gamificationService as unknown as GamificationService,
      new PresenceService(),
    );
  });

  it('persists configured XP for each PvP outcome and processes only the winner after persistence', async () => {
    let persist!: () => void;
    scoreRepository.recordMatch.mockReturnValue(
      new Promise<void>((resolve) => { persist = resolve; }),
    );
    matchService.matchOutcome.mockImplementation((side: string) =>
      side === 'a' ? 'win' : 'lose',
    );

    gateway.complete(session(true), 'session-id');

    const results = scoreRepository.recordMatch.mock.calls[0][0] as ScoreWithXp[];
    expect(results.map(({ score, xp }) => [score.outcome, xp])).toEqual([
      ['win', 10],
      ['lose', 2],
    ]);
    expect(results[0].score.opponentId).toBe('player-b');
    expect(gamificationService.processPvpWin).not.toHaveBeenCalled();

    persist();
    await Promise.resolve();

    expect(gamificationService.processPvpWin).toHaveBeenCalledTimes(1);
    expect(gamificationService.processPvpWin).toHaveBeenCalledWith('player-a');
  });

  it('records bot matches with zero XP and does not process achievements', async () => {
    matchService.matchOutcome.mockReturnValue('win');

    gateway.complete(session(false), 'bot-session-id');
    await Promise.resolve();

    const results = scoreRepository.recordMatch.mock.calls[0][0] as ScoreWithXp[];
    expect(results).toHaveLength(1);
    expect(results[0].score.opponentId).toBeNull();
    expect(results[0].xp).toBe(0);
    expect(gamificationService.processPvpWin).not.toHaveBeenCalled();
  });

  it('uses the configured draw and forfeit XP values for PvP results', () => {
    matchService.matchOutcome.mockReturnValueOnce('draw').mockReturnValueOnce('forfeit');

    gateway.complete(session(true), 'draw-forfeit-session');

    const results = scoreRepository.recordMatch.mock.calls[0][0] as ScoreWithXp[];
    expect(results.map(({ score, xp }) => [score.outcome, xp])).toEqual([
      ['draw', 5],
      ['forfeit', 0],
    ]);
  });
});

describe('GameGateway - presence tracking', () => {
  let jwtService: JwtService;
  let denyList: DenyList;
  let presenceService: PresenceService;
  let gateway: TestGateway;

  function fakeSocket(): WebSocket {
    return { pause: jest.fn(), resume: jest.fn(), close: jest.fn(), readyState: 1 } as unknown as WebSocket;
  }

  function fakeRequest(token: string): IncomingMessage {
    return { headers: { authorization: `Bearer ${token}` } } as unknown as IncomingMessage;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    denyList = new DenyList();
    presenceService = new PresenceService();
    gateway = new TestGateway(
      {} as MatchService,
      jwtService,
      denyList,
      {} as ScoreRepository,
      {} as GamificationService,
      presenceService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks the user online once authenticated', async () => {
    const client = fakeSocket();
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-1', type: 'access', jti: 'jti-1' });

    gateway.handleConnection(client, fakeRequest('token'));
    await jest.advanceTimersByTimeAsync(0);

    expect(presenceService.isOnline('user-1')).toBe(true);
  });

  it('marks the user offline once disconnected', async () => {
    const client = fakeSocket();
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-1', type: 'access', jti: 'jti-1' });

    gateway.handleConnection(client, fakeRequest('token'));
    await jest.advanceTimersByTimeAsync(0);

    gateway.handleDisconnect(client);

    expect(presenceService.isOnline('user-1')).toBe(false);
  });

  it('does not register a socket that closed while verifyAsync was still pending', async () => {
    const client = fakeSocket();
    let resolveVerify!: (payload: unknown) => void;
    (jwtService.verifyAsync as jest.Mock).mockImplementation(
      () => new Promise((resolve) => { resolveVerify = resolve; }),
    );

    gateway.handleConnection(client, fakeRequest('token'));
    (client as unknown as { readyState: number }).readyState = 3; // WebSocket.CLOSED
    resolveVerify({ sub: 'user-1', type: 'access', jti: 'jti-1' });
    await jest.advanceTimersByTimeAsync(0);

    expect(presenceService.isOnline('user-1')).toBe(false);
    expect(client.resume).not.toHaveBeenCalled();
  });
});
