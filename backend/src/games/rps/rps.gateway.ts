import { ConnectedSocket, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, MessageBody, OnGatewayConnection } from '@nestjs/websockets';
import { WebSocket } from 'ws';
import { RpsService } from './rps.service';
import { ScoreService } from '../../scores';
import { RPS_GAME_ID } from './rps.constants';
import { GameGateway, type Session } from '../game.gateway';
import { MatchService } from '../match/match.service';
import { GamificationService } from '../../gamification';
import type { Move } from './rps.types';
import type { Player } from '../match/match.types';
import { PresenceService } from '../../presence/presence.service';
import { GameSettingsService } from '../settings/game-settings.service';
import { SocketAuthenticator } from '../../auth/socketAuthenticator';
import { ActiveMatchService } from '../gateway-utils/active-match.service';

const ROUND_TIME_LIMIT = 60_000;
@WebSocketGateway({ path: '/games/rps' })
export class RpsGateway extends GameGateway implements OnGatewayConnection, OnGatewayDisconnect  {
    protected readonly gameId = RPS_GAME_ID;
    protected readonly roundTimeLimit = ROUND_TIME_LIMIT;

    constructor(
        private readonly rpsService: RpsService,
        matchService: MatchService,
        socketAuthenticator: SocketAuthenticator,
        scoreService: ScoreService,
        gamificationService: GamificationService,
        gameSettingsService: GameSettingsService,
        presenceService: PresenceService,
        activeMatchService: ActiveMatchService,

    ) {
        super(matchService, socketAuthenticator, scoreService, gamificationService, gameSettingsService, presenceService, activeMatchService);
    }

    @SubscribeMessage('move')
    move(@ConnectedSocket() client: WebSocket, @MessageBody() body: unknown): void {
        const session = this.currentSession(client);
        if (!session)
            return this.send(client, 'error', { message: 'not in a session' });

        const move = this.rpsService.parseMove(String(body ?? ''));
        if (!move)
            return this.send(client, 'error', { message: 'not a move' });

        const side = this.sideOf(session, client)!;
        const sessionId = this.sessionIdOf(client)!;
        if (!session.b)
            return this.resolve(session, sessionId, move, this.rpsService.randomMove());

        const pending = session.pending as Partial<Record<Player, Move>>;
        if (pending[side])
            return this.send(client, 'error', { message: 'already moved' });

        pending[side] = move;
        if (!pending.a || !pending.b)
            return this.send(client, 'waiting', { message: 'waiting for opponent' });

        const [moveA, moveB] = [pending.a, pending.b];
        session.pending = {};
        this.resolve(session, sessionId, moveA, moveB);
    }

    private resolve(session: Session, sessionId: string, moveA: Move, moveB: Move): void {
        const powerUps = session.pendingPowerUps;
        session.pendingPowerUps = {};
        const played = this.rpsService.playRound(session.state, moveA, moveB, powerUps);
        session.state = played.state;
        const over = this.matchService.gameOver(played.state);
        if (!over && session.b)
            this.startRoundTimer(session);

        for (const side of this.sides(session)) {
            const client = side === 'a' ? session.a.client : session.b!.client;
            if (!client)
                continue ;

            this.send(client, 'round', {
                ownMove: side === 'a' ? played.round.moveA : played.round.moveB,
                opMove: side === 'a' ? played.round.moveB : played.round.moveA,
                outcome: this.rpsService.outcomeFor(side, played.round),
                ownPowerUp: powerUps[side] ?? null,
                opPowerUp: powerUps[side === 'a' ? 'b' : 'a'] ?? null,
                ...this.viewFor(side, played.state),
                roundTimeLeft: over ? null : session.clock.timeLeft(),
            });
        }

        if (over)
            this.finish(session, sessionId);
    }

}
