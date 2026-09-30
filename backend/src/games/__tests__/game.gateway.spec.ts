import { JwtService } from '@nestjs/jwt';
import { DenyList } from '../../auth/denyList';
import { GamificationService } from '../../gamification';
import { ScoreRepository, type ScoreWithXp } from '../../scores';
import { MatchService } from '../match/match.service';
import { GameGateway, type Session } from '../game.gateway';

class TestGateway extends GameGateway {
  protected readonly gameId = 'test-game';
  protected readonly bestOf = 3;
  protected readonly roundTimeLimit = 60_000;

  constructor(
    matchService: MatchService,
    scoreRepository: ScoreRepository,
    gamificationService: GamificationService,
  ) {
    super(
      matchService,
      {} as JwtService,
      {} as DenyList,
      scoreRepository,
      gamificationService,
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
      scoreRepository as unknown as ScoreRepository,
      gamificationService as unknown as GamificationService,
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
