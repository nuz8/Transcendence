import type { JwtService } from '@nestjs/jwt';
import type { WebSocket } from 'ws';
import { DenyList } from '../../../auth/denyList';
import { SocketAuthenticator } from '../../../auth/socketAuthenticator';
import { SocketAuthRegistry } from '../../../auth/socketAuthRegistry';
import type { GamificationService } from '../../../gamification';
import type { ScoreService } from '../../../scores';
import { PresenceService } from '../../../presence/presence.service';
import { MatchService } from '../../match/match.service';
import { ActiveMatchService } from '../../gateway-utils/active-match.service';
import type { GameSettingsService } from '../../settings/game-settings.service';
import { TTT_TURN_TIME_LIMIT_MS } from '../tictactoe.constants';
import { TicTacToeGateway } from '../tictactoe.gateway';
import { TicTacToeService } from '../tictactoe.service';

describe('TicTacToeGateway', () => {
  type Sent = { event: string; data: Record<string, unknown> };
  type Client = { socket: WebSocket; sent: Sent[] };

  let gateway: TicTacToeGateway;
  let registry: SocketAuthRegistry;

  beforeEach(() => {
    jest.useFakeTimers();
    const denyList = new DenyList();
    registry = new SocketAuthRegistry(denyList);
    // Fake verifier: the token string doubles as the user id.
    const verifyAsync = jest.fn((token: string) => Promise.resolve({
      sub: token, type: 'access', jti: token, exp: Math.floor(Date.now() / 1000) + 3600,
    }));
    gateway = new TicTacToeGateway(
      new TicTacToeService(),
      new MatchService(),
      new SocketAuthenticator({ verifyAsync } as unknown as JwtService, denyList, registry),
      { recordMatch: jest.fn().mockResolvedValue(undefined) } as unknown as ScoreService,
      { levelOf: jest.fn().mockResolvedValue(0), processPvpWin: jest.fn().mockResolvedValue([]) } as unknown as GamificationService,
      { settingsFor: jest.fn().mockResolvedValue(null) } as unknown as GameSettingsService, // null -> default settings
      new PresenceService(),
      new ActiveMatchService(),
    );
    gateway.onModuleInit();
  });

  afterEach(() => {
    gateway.onModuleDestroy();
    registry.onModuleDestroy();
    jest.useRealTimers();
  });

  // Opens an authenticated fake socket that records every message sent to it.
  async function connect(userId: string): Promise<Client> {
    const sent: Sent[] = [];
    const socket = {
      readyState: 1, pause: jest.fn(), resume: jest.fn(), close: jest.fn(),
      send: (raw: string) => { sent.push(JSON.parse(raw) as Sent); },
    } as unknown as WebSocket;
    gateway.handleConnection(socket);
    await gateway.auth(socket, { token: userId });
    return { socket, sent };
  }

  const last = (c: Client) => c.sent[c.sent.length - 1];
  const matchedOf = (c: Client) => c.sent.find((m) => m.event === 'matched')!.data;

  // Pairs two players through the queue and returns them ordered by who moves first.
  async function startMatch(): Promise<{ first: Client; second: Client }> {
    const p1 = await connect('p1');
    const p2 = await connect('p2');
    await gateway.queue(p1.socket);
    await gateway.queue(p2.socket);
    return matchedOf(p1).yourTurn === true ? { first: p1, second: p2 } : { first: p2, second: p1 };
  }

  it('is queue-only: create is rejected', async () => {
    const a = await connect('p1');
    await gateway.create(a.socket);
    expect(last(a)).toEqual({ event: 'error', data: { message: 'this game does not support bot mode' } });
  });

  it('matches two players with symbols, an empty board and exactly one starter', async () => {
    const { first, second } = await startMatch();
    expect(matchedOf(first)).toMatchObject({ board: Array(9).fill(null), yourTurn: true });
    expect(matchedOf(second)).toMatchObject({ yourTurn: false });
    expect([matchedOf(first).symbol, matchedOf(second).symbol].sort()).toEqual(['O', 'X']);
  });

  it('rejects out-of-turn, invalid and occupied-cell moves', async () => {
    const { first, second } = await startMatch();

    gateway.move(second.socket, 0);
    expect(last(second)).toEqual({ event: 'error', data: { message: 'not your turn' } });
    gateway.move(first.socket, 'x');
    expect(last(first)).toEqual({ event: 'error', data: { message: 'not a valid cell (0-8)' } });

    gateway.move(first.socket, 4);
    gateway.move(second.socket, 4);
    expect(last(second)).toEqual({ event: 'error', data: { message: 'cell already taken' } });
  });

  it('scores a won round and gives the next round to the other player', async () => {
    const { first, second } = await startMatch();
    for (const [client, cell] of [[first, 0], [second, 3], [first, 1], [second, 4], [first, 2]] as const)
      gateway.move(client.socket, cell);

    expect(last(first)).toMatchObject({ event: 'round', data: { outcome: 'win', yourTurn: false, ownScore: 1, opScore: 0 } });
    expect(last(second)).toMatchObject({ event: 'round', data: { outcome: 'lose', yourTurn: true } });
  });

  it('forfeits the player on turn when the turn clock runs out', async () => {
    const { first, second } = await startMatch();
    await jest.advanceTimersByTimeAsync(TTT_TURN_TIME_LIMIT_MS);

    expect(last(first)).toMatchObject({ event: 'over', data: { outcome: 'forfeit' } });
    expect(last(second)).toMatchObject({ event: 'over', data: { outcome: 'win' } });
  });
});