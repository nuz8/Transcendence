import { ConnectedSocket, MessageBody, SubscribeMessage } from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { ScoreEntity, ScoreService } from '../scores';
import { MatchService } from './match/match.service';
import { POWER_UPS, type MatchState, type Player, type PowerUp } from './match/match.types';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GamificationService } from '../gamification';
import { PresenceService } from '../presence/presence.service';
import { GameSettingsService } from './settings/game-settings.service';
import { DEFAULT_GAME_SETTINGS } from './settings/game-settings.constants';
import { SocketAuthenticator } from '../auth/socketAuthenticator';
import { ActiveMatchService } from './gateway-utils/active-match.service';
import { MatchQueue, type MatchSettings, type Queued } from './gateway-utils/match-queue';
import { RoundClock } from './gateway-utils/round-clock';

const RECONNECT_TIME_MS = 30_000;

type Seat = {
    userId: string;
    client: WebSocket | null;
    dcTimer: NodeJS.Timeout | null;
};

export type Session = {
    state: MatchState;
    a: Seat;
    b: Seat | null;
    pending: Partial<Record<Player, unknown>>;
    clock: RoundClock;
    pendingPowerUps: Partial<Record<Player, PowerUp>>;
};

export abstract class GameGateway implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(GameGateway.name);
    private readonly sessions = new Map<string, Session>();
    private readonly sessionBySocket = new Map<WebSocket, string>();
    private readonly matchQueue = new MatchQueue((settings, first, second) => this.startPairedMatch(settings, first, second));

    constructor(
        protected readonly matchService: MatchService,
        protected readonly socketAuthenticator: SocketAuthenticator,
        private readonly scoreService: ScoreService,
        private readonly gamificationService: GamificationService,
        private readonly gameSettingsService: GameSettingsService,
        private readonly presenceService: PresenceService,
        private readonly activeMatchService: ActiveMatchService,
    ) {}

    protected abstract readonly gameId: string;
    protected abstract readonly roundTimeLimit: number;

    onModuleInit(): void {
        this.matchQueue.start();
    }

    onModuleDestroy(): void {
        this.matchQueue.stop();
        for (const [sessionId, session] of this.sessions)
            this.endSession(sessionId, session);
    }

    //====================================//
    //========Connection and login========//
    //====================================//
    handleConnection(client: WebSocket): void {
        this.socketAuthenticator.begin(client);
    }

    handleDisconnect(client: WebSocket): void {
        this.dequeue(client);

        const sessionId = this.sessionBySocket.get(client);
        const session = sessionId ? this.sessions.get(sessionId) : undefined;
        const side = session ? this.sideOf(session, client) : undefined;
        if (session && side) {
            const seat = side === 'a' ? session.a : session.b!;
            const other = side === 'a' ? session.b : session.a;
            seat.client = null;
            this.sessionBySocket.delete(client);
            session.clock.pause();
            seat.dcTimer = setTimeout(() => this.dc(sessionId!, side), RECONNECT_TIME_MS);
            if (other?.client)
                this.send(other.client, 'opponent_disconnected', { reconnectTime: RECONNECT_TIME_MS });
        } else if (sessionId) {
            this.sessionBySocket.delete(client);
        }
        const userId = this.socketAuthenticator.release(client);
        if (userId)
            this.presenceService.disconnect(userId, client);
    }

    @SubscribeMessage('auth')
    async auth(@ConnectedSocket() client: WebSocket, @MessageBody() body: unknown): Promise<void> {
        await this.socketAuthenticator.authenticate(client, body, (userId) => this.presenceService.connect(userId, client));
    }

    //==============================================//
    //========Starting a match: bot or queue========//
    //==============================================//
    @SubscribeMessage('create')
    async create(@ConnectedSocket() client: WebSocket): Promise<void> {
        const userId = this.socketAuthenticator.userOf(client);
        if (!userId)
            return this.send(client, 'error', { message: 'not authenticated' });

        const { target, mode, powerUps } = await this.settingsFor(userId);

        if (!this.socketAuthenticator.userOf(client))
            return ;
        if (this.matchQueue.has(userId))
            return this.send(client, 'error', { message: 'already in queue' });
        if (this.activeMatchService.isBusy(userId))
            return this.refuseBusy(client, userId);

        const sessionId = randomUUID();
        const session = this.newSession(sessionId, this.matchService.createMatch(target, mode, powerUps), { userId, client, dcTimer: null }, null);
        this.sessionBySocket.set(client, sessionId);
        this.activeMatchService.add(userId, this.gameId, sessionId);
        this.send(client, 'created', { sessionId });
        this.sendJoined(client, session, 'a');
    }

    @SubscribeMessage('queue')
    async queue(@ConnectedSocket() client: WebSocket): Promise<void> {
        const userId = this.socketAuthenticator.userOf(client);
        if (!userId)
            return this.send(client, 'error', { message: 'not authenticated' });
        
        const [settings, level] = await Promise.all([this.settingsFor(userId), this.levelFor(userId)]);
        
        if (!this.socketAuthenticator.userOf(client))
            return ;
        if (this.matchQueue.has(userId))
            return this.send(client, 'error', { message: 'already in queue' });
        if (this.activeMatchService.isBusy(userId))
            return this.refuseBusy(client, userId);
        this.activeMatchService.add(userId, this.gameId);

        if (!this.matchQueue.join({ client, userId }, settings, level))
            this.send(client, 'waiting', { message: 'waiting for an opponent' });
    }

    @SubscribeMessage('leave-queue')
    leaveQueue(@ConnectedSocket() client: WebSocket): void {
        if (!this.dequeue(client))
            return this.send(client, 'error', { message: 'not in a queue' });
        this.send(client, 'left queue', {});
    }

    private dequeue(client: WebSocket): boolean {
        const userId = this.matchQueue.leave(client);
        if (userId)
            this.activeMatchService.remove(userId);
        return userId !== undefined;
    }

    private refuseBusy(client: WebSocket, userId: string): void {
        const where = this.activeMatchService.whereBusy(userId);
        this.send(client, 'error', { message: 'already in a session', sessionId: where?.sessionId, gameId: where?.gameId });
    }

    private async settingsFor(userId: string): Promise<MatchSettings> {
        try {
            const settings = await this.gameSettingsService.settingsFor(userId, this.gameId);
            return settings ? { target: settings.target, mode: settings.mode, powerUps: settings.powerUps } : DEFAULT_GAME_SETTINGS;
        } catch (error) {
            this.logger.error(`Failed to read game settings for user ${userId}`, error);
            return DEFAULT_GAME_SETTINGS;
        }
    }

    private async levelFor(userId: string): Promise<number> {
        try {
            return await this.gamificationService.levelOf(userId);
        } catch (error) {
            this.logger.error(`Failed to read level for user ${userId}`, error);
            return 0;
        }
    }

    //==================================//
    //========Creating a session========//
    //==================================//
    private startPairedMatch(settings: MatchSettings, first: Queued, second: Queued): void {
        const sessionId = randomUUID();
        const session = this.newSession(
            sessionId,
            this.matchService.createMatch(settings.target, settings.mode, settings.powerUps),
            { userId: first.userId, client: first.client, dcTimer: null },
            { userId: second.userId, client: second.client, dcTimer: null },
        );
        this.sessionBySocket.set(first.client, sessionId);
        this.sessionBySocket.set(second.client, sessionId);
        this.activeMatchService.add(first.userId, this.gameId, sessionId);
        this.activeMatchService.add(second.userId, this.gameId, sessionId);
        this.startRoundTimer(session);

        for (const player of [first, second]) {
            this.send(player.client, 'matched', {
                sessionId,
                mode: session.state.mode,
                target: session.state.target,
                powerUps: session.state.powerUps,
                roundTimeLeft: session.clock.timeLeft(),
            });
        }
    }

    private newSession(sessionId: string, state: MatchState, a: Seat, b: Seat | null): Session {
        const session: Session = {
            state,
            a,
            b,
            pending: {},
            clock: new RoundClock(() => this.roundExpired(sessionId)),
            pendingPowerUps: {},
        };
        this.sessions.set(sessionId, session);
        return session;
    }

    //=======================================//
    //========Joining and coming back========//
    //=======================================//
    @SubscribeMessage('join')
    join(@ConnectedSocket() client: WebSocket, @MessageBody() sessionId: unknown): void {
        if (!this.socketAuthenticator.userOf(client))
            return this.send(client, 'error', { message: 'not authenticated' });
        const session = typeof sessionId === 'string' ? this.sessions.get(sessionId) : undefined;
        if (!session)
            return this.send(client, 'error', { message: 'unknown session' });
        
        const userId = this.socketAuthenticator.userOf(client);
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
        this.resumeRoundTimer(session);
        const side = this.sideOf(session, client)!;
        const other = side === 'a' ? session.b : session.a;
        if (other?.client)
            this.send(other.client, 'opponent_reconnected', { roundTimeLeft: session.clock.timeLeft() });
        this.sendJoined(client, session, side);
    }

    private sendJoined(client: WebSocket, session: Session, side: Player): void {
        this.send(client, 'joined', { mode: session.state.mode, target: session.state.target, powerUps: session.state.powerUps, powerUpsLeft: session.state.powerUpsLeft[side], ...this.viewFor(side, session.state), roundsPlayed: session.state.roundsPlayed, moved: session.pending[side] !== undefined, powerUp: session.pendingPowerUps[side] ?? null, roundTimeLeft: session.clock.timeLeft() });
    }

    //=======================//
    //========Playing========//
    //=======================//
    @SubscribeMessage('power-up')
    powerUp(@ConnectedSocket() client: WebSocket, @MessageBody() body: unknown): void {
        const session = this.currentSession(client);
        if (!session)
            return this.send(client, 'error', { message: 'not in a session' });
        if (!session.state.powerUps)
            return this.send(client, 'error', { message: 'power-ups not enabled' });

        const powerUp = POWER_UPS.find((name) => name === body);
        if (!powerUp)
            return this.send(client, 'error', { message: 'unknown power-up' });

        const side = this.sideOf(session, client)!;
        if (session.pending[side] !== undefined)
            return this.send(client, 'error', { message: 'already used a move' });
        if (session.pendingPowerUps[side])
            return this.send(client, 'error', { message: 'already used a power-up' });
        if (!session.state.powerUpsLeft[side].includes(powerUp))
            return this.send(client, 'error', { message: 'power-up not available' });

        session.pendingPowerUps[side] = powerUp;
        this.send(client, 'powerup_accepted', { powerUp });
    }
    
    @SubscribeMessage('quit')
    quit(@ConnectedSocket() client: WebSocket): void {
        const session = this.currentSession(client);
        if (!session)
            return this.send(client, 'error', { message: 'not in a session' });
        session.state = this.matchService.forfeit(session.state, this.sideOf(session, client)!);
        this.finish(session, this.sessionIdOf(client)!);
    }

    //===========================//
    //========Round clock========//
    //===========================//
    protected startRoundTimer(session: Session): void {
        session.clock.reset(this.roundTimeLimit);
        this.resumeRoundTimer(session);
    }

    private resumeRoundTimer(session: Session): void {
        if (session.a.client && session.b?.client)
            session.clock.resume();
    }

    private roundExpired(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session)
            return ;

        const idle = this.sides(session).filter((side) => session.pending[side] === undefined);
        if (idle.length !== 1)
            return this.cancel(sessionId, session, 'nobody moved in time');

        session.state = this.matchService.forfeit(session.state, idle[0]);
        this.finish(session, sessionId);
    }

    //==============================//
    //========Ending a match========//
    //==============================//
    protected finish(session: Session, sessionId: string): void {
        const { state } = session;

        this.endSession(sessionId, session);

        const results: ScoreEntity[] = [];
        for (const side of this.sides(session)) {
            const seat = side === 'a' ? session.a : session.b!;
            const other = side === 'a' ? session.b : session.a;
            const outcome = this.matchService.matchOutcome(side, state);
            const view = this.viewFor(side, state);

            results.push(new ScoreEntity({
                sessionId,
                userId: seat.userId,
                opponentId: other?.userId ?? null,
                gameId: this.gameId,
                value: view.ownScore,
                outcome,
                achievedAt: new Date(),
            }));
            if (seat.client)
                this.send(seat.client, 'over', { outcome, ...view });
        }

        const pvpWinners = results
            .filter((score) => score.opponentId !== null && score.outcome === 'win')
            .map((score) => score.userId);

        void this.scoreService.recordMatch(results)
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

        if (session.state.roundsPlayed === 0) 
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

    private endSession(sessionId: string, session: Session): void {
        for (const seat of [session.a, session.b]){
            if (seat)
                this.activeMatchService.remove(seat.userId);
            if (seat?.dcTimer)
                clearTimeout(seat.dcTimer);
            if (seat?.client)
                this.sessionBySocket.delete(seat.client);
        }
        session.clock.stop();
        this.sessions.delete(sessionId);
    }

    //========Helpers for game gateways========//
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
