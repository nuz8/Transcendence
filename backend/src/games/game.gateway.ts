import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, SubscribeMessage } from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { DenyList } from '../auth/denyList';
import { ScoreEntity, ScoreRepository, type ScoreWithXp, XP_BY_OUTCOME } from '../scores';
import { MatchService } from './match/match.service';
import type { MatchState, Player } from './match/match.types';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { GamificationService } from '../gamification';
import { PresenceService } from '../presence/presence.service';

const RECONNECT_TIME_MS = 30_000;

export type Side = {
    userId: string;
    client: WebSocket | null;
    dcTimer: NodeJS.Timeout | null;
};

export type Session = {
    state: MatchState;
    a: Side;
    b: Side | null;
    roundsPlayed: number;
    pending: Partial<Record<Player, unknown>>;
    roundTimer: NodeJS.Timeout | null;
};

export abstract class GameGateway implements OnModuleDestroy {
    private readonly logger = new Logger(GameGateway.name);
    private readonly users = new Map<WebSocket, string>();
    private readonly sessions = new Map<string, Session>();
    private readonly sessionBySocket = new Map<WebSocket, string>();
    private waiting: { client: WebSocket; userId: string } | null = null;
    
    constructor(
        protected readonly matchService: MatchService,
        private readonly jwtService: JwtService,
        private readonly denyList: DenyList,
        private readonly scoreRepository: ScoreRepository,
        private readonly gamificationService: GamificationService,
        private readonly presenceService: PresenceService,
    ) {}

    protected abstract readonly gameId: string;
    protected abstract readonly bestOf: number;
    protected abstract readonly roundTimeLimit: number;

    onModuleDestroy(): void {
        for (const [sessionId, session] of this.sessions)
            this.endSession(sessionId, session);
    }

    handleConnection(client: WebSocket, request: IncomingMessage): void {
        client.pause();
        void this.authenticate(client, request);
    }

    handleDisconnect(client: WebSocket): void {
        if (this.waiting?.client === client)
            this.waiting = null;

        const sessionId = this.sessionBySocket.get(client);
        const session = sessionId ? this.sessions.get(sessionId) : undefined;
        const side = session ? this.sideOf(session, client) : undefined;
        if (session && side) {
            const seat = side === 'a' ? session.a : session.b!;
            const other = side === 'a' ? session.b : session.a;
            seat.client = null;
            this.sessionBySocket.delete(client);
            seat.dcTimer = setTimeout(() => this.dc(sessionId!, side), RECONNECT_TIME_MS);
            if (other?.client)
                this.send(other.client, 'opponent_disconnected', { reconnectTime: RECONNECT_TIME_MS });
        } else if (sessionId) {
            this.sessionBySocket.delete(client);
            this.sessions.delete(sessionId);
        }
        const userId = this.users.get(client);
        this.users.delete(client);
        if (userId)
            this.presenceService.disconnect(userId, client);
    }

    @SubscribeMessage('create')
    create(@ConnectedSocket() client: WebSocket): void {
        if (!this.users.has(client))
            return this.send(client, 'error', { message: 'not authenticated' });
        if (this.sessionBySocket.has(client))
            return this.send(client, 'error', { message: 'already in a session' });

        if (this.waiting?.client === client)
            return this.send(client, 'error', { message: 'already in queue' });

        const sessionId = randomUUID();
        this.sessions.set(sessionId, {
            state: this.matchService.createMatch(this.bestOf),
            a: { userId: this.users.get(client)!, client: null, dcTimer: null },
            b: null,
            roundsPlayed: 0,
            pending: {},
            roundTimer: null,
        });
        this.sessionBySocket.set(client, sessionId);
        this.send(client, 'created', { sessionId });
    }

    @SubscribeMessage('queue')
    queue(@ConnectedSocket() client: WebSocket): void {
        if (!this.users.has(client))
            return this.send(client, 'error', { message: 'not authenticated' });
        if (this.sessionBySocket.has(client))
            return this.send(client, 'error', { message: 'already in a session' });

        const userId = this.users.get(client)!;
        const opponent = this.waiting;
        if (!opponent) {
            this.waiting = { client, userId };
            return this.send(client, 'waiting', { message: 'waiting for an opponent' });
        }
        if (opponent.client === client)
            return this.send(client, 'error', { message: 'already in queue' });
        if (opponent.userId === userId)
            return this.send(client, 'error', { message: 'already in queue' });

        this.waiting = null;
        
        const sessionId = randomUUID();
        const session: Session = {
            state: this.matchService.createMatch(this.bestOf),
            a: { userId: opponent.userId, client: opponent.client, dcTimer: null },
            b: { userId, client, dcTimer: null },
            roundsPlayed: 0,
            pending: {},
            roundTimer: null,
        };

        this.sessions.set(sessionId, session);
        this.sessionBySocket.set(opponent.client, sessionId);
        this.sessionBySocket.set(client, sessionId);
        this.startRoundTimer(sessionId, session);

        for (const side of this.sides(session)) {
            this.send(side === 'a' ? opponent.client : client, 'matched', {
                sessionId,
                targetRounds: session.state.targetRounds,
            });
        }
    }

    @SubscribeMessage('join')
    join(@ConnectedSocket() client: WebSocket, @MessageBody() sessionId: unknown): void {
        if (!this.users.has(client))
            return this.send(client, 'error', { message: 'not authenticated' });
        const session = typeof sessionId === 'string' ? this.sessions.get(sessionId) : undefined;
        if (!session)
            return this.send(client, 'error', { message: 'unknown session' });
        
        const userId = this.users.get(client);
        const seat = [session.a, session.b].find(s => s?.userId === userId);
        if (!seat)
            return this.send(client, 'error', { message: 'not your session' });
        if (seat.client)
            return this.send(client, 'error', { message: 'session already joined' });
        if (seat.dcTimer) {
            clearTimeout(seat.dcTimer);
            seat.dcTimer = null;
        }

        seat.client = client;
        this.sessionBySocket.set(client, sessionId as string);
        const side = this.sideOf(session, client)!;
        const other = side === 'a' ? session.b : session.a;
        if (other?.client)
            this.send(other.client, 'opponent_reconnected', {});
        this.send(client, 'joined', { targetRounds: session.state.targetRounds, ...this.viewFor(side, session.state), roundsPlayed: session.roundsPlayed });
    }
    
    @SubscribeMessage('quit')
    quit(@ConnectedSocket() client: WebSocket): void {
        const session = this.currentSession(client);
        if (!session)
            return this.send(client, 'quit', { message: 'no match' });
        session.state = this.matchService.forfeit(session.state, this.sideOf(session, client)!);
        this.finish(session, this.sessionIdOf(client)!);
    }

    protected finish(session: Session, sessionId: string): void {
        const { state } = session;

        this.endSession(sessionId, session);

        const results: ScoreWithXp[] = [];
        for (const side of this.sides(session)) {
            const seat = side === 'a' ? session.a : session.b!;
            const other = side === 'a' ? session.b : session.a;
            const outcome = this.matchService.matchOutcome(side, state);
            const view = this.viewFor(side, state);

            results.push({
                score: new ScoreEntity({
                    sessionId,
                    userId: seat.userId,
                    opponentId: other?.userId ?? null,
                    gameId: this.gameId,
                    value: view.ownScore,
                    outcome,
                    achievedAt: new Date(),
                }),
                xp: session.b ? XP_BY_OUTCOME[outcome] : 0,
            });
            if (seat.client)
                this.send(seat.client, 'over', { outcome, ...view });
        }

        const pvpWinners = results
            .filter(({ score }) => score.opponentId !== null && score.outcome === 'win')
            .map(({ score }) => score.userId);

        void this.scoreRepository.recordMatch(results)
            .then(async () => {
                for (const userId of pvpWinners) {
                    try {
                        await this.gamificationService.processPvpWin(userId);
                    } catch (error) {
                        this.logger.error(
                            `Failed to process PvP achievements for user ${userId} after session ${sessionId}`,
                            error,
                        );
                    }
                }
            })
            .catch((err) => this.logger.error(
                `Failed to save result of session ${sessionId}`,
                err,
            ));
    }

    private dc(sessionId: string, side: Player): void {
        const session = this.sessions.get(sessionId);
        const seat = side === 'a' ? session?.a : session?.b;
        if (!session || !seat || seat.client)
            return ;

        if (session.roundsPlayed === 0) 
            return this.cancel(sessionId, session, 'opponent disconnected before first round');

        session.state = this.matchService.forfeit(session.state, side);
        this.finish(session, sessionId);
    }

    private cancel(sessionId: string, session: Session, message: string): void {
        this.endSession(sessionId, session);
        for (const seat of [session.a, session.b])
            if (seat?.client)
                this.send(seat.client, 'cancelled', { message });
    }

    protected startRoundTimer(sessionId: string, session: Session): void {
        if (session.roundTimer)
            clearTimeout(session.roundTimer);
        session.roundTimer = setTimeout(() => this.roundExpired(sessionId), this.roundTimeLimit);
    }

    private roundExpired(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session)
            return ;

        session.roundTimer = null;
        const idle = this.sides(session).filter((side) => session.pending[side] === undefined);
        if (idle.length !== 1)
            return this.cancel(sessionId, session, 'nobody moved in time');

        session.state = this.matchService.forfeit(session.state, idle[0]);
        this.finish(session, sessionId);
    }

    private endSession(sessionId: string, session: Session): void {
        for (const seat of [session.a, session.b]){
            if (seat?.dcTimer)
                clearTimeout(seat.dcTimer);
            if (seat?.client)
                this.sessionBySocket.delete(seat.client);
        }
        if (session.roundTimer)
            clearTimeout(session.roundTimer);
        this.sessions.delete(sessionId);
    }

    private async authenticate(client: WebSocket, request: IncomingMessage): Promise<void> {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        if (type !== 'Bearer' || !token)
            return client.close(401, 'unauthorized');

        try {
            const payload = await this.jwtService.verifyAsync<{sub: string; type: string; jti: string;}>(token);
            
            if (payload.type !== 'access')
                return client.close(401, 'unauthorized');
            if (this.denyList.isRevoked(payload.jti))
                return client.close(401, 'unauthorized');
            if (client.readyState !== WebSocket.OPEN) return;

            this.users.set(client, payload.sub);
            this.presenceService.connect(payload.sub, client);
            client.resume();
            } catch {
                client.close(401, 'unauthorized');
            }
        }

    protected sideOf(session: Session, client: WebSocket): Player | undefined {
        if (session.a.client === client)
            return 'a';
        if (session.b?.client === client)
            return 'b';
        return undefined;
    }

    protected sides(session: Session): Player[] {
        return session.b ? ['a', 'b'] : ['a'];
    }

    protected sessionIdOf(client: WebSocket): string | undefined {
        return this.sessionBySocket.get(client);
    }
    protected viewFor(side: Player, state: MatchState) {
        return {
            ownScore: side === 'a' ? state.scoreA : state.scoreB,
            opScore: side === 'a' ? state.scoreB : state.scoreA,
        };
    }

    protected currentSession(client: WebSocket): Session | undefined {
        const sessionId = this.sessionBySocket.get(client);
        const session = sessionId ? this.sessions.get(sessionId) : undefined;
        return session && this.sideOf(session, client) ? session : undefined;
    }


    protected send(client: WebSocket, event: string, data: unknown): void {
        if (client.readyState !== WebSocket.OPEN)
            return ;

        client.send(JSON.stringify({ event, data }));
    }
}