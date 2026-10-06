import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, SubscribeMessage } from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { DenyList } from '../auth/denyList';
import { ScoreEntity, ScoreService } from '../scores';
import { MatchService } from './match/match.service';
import { POWER_UPS, type MatchState, type Player, type MatchMode, type PowerUp } from './match/match.types';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GamificationService } from '../gamification';
import { PresenceService } from '../presence/presence.service';
import { GameSettingsService } from './settings/game-settings.service';
import { DEFAULT_GAME_SETTINGS } from './settings/game-settings.constants';

const RECONNECT_TIME_MS = 30_000;
const MATCH_LEVEL_RANGE = 2;
const WIDEN_AFTER_MS = 15_000;
const QUEUE_SWEEP_INTERVAL_MS = 5_000;

export type Queued = { client: WebSocket; userId: string };
type MatchSettings = { target: number; mode: MatchMode; powerUps: boolean };
type Waiter = Queued & { settings: MatchSettings, level: number, since: number };

export type Side = {
    userId: string;
    client: WebSocket | null;
    dcTimer: NodeJS.Timeout | null;
};

export type Session = {
    state: MatchState;
    a: Side;
    b: Side | null;
    pending: Partial<Record<Player, unknown>>;
    roundTimer: NodeJS.Timeout | null;
    pendingPowerUps: Partial<Record<Player, PowerUp>>;
};

export abstract class GameGateway implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(GameGateway.name);
    private readonly users = new Map<WebSocket, string>();
    private readonly sessions = new Map<string, Session>();
    private readonly sessionBySocket = new Map<WebSocket, string>();
    private readonly waiting = new Map<string, Waiter[]>();
    private queueSweep: NodeJS.Timeout | null = null;

    
    constructor(
        protected readonly matchService: MatchService,
        private readonly jwtService: JwtService,
        private readonly denyList: DenyList,
        private readonly scoreService: ScoreService,
        private readonly gamificationService: GamificationService,
        private readonly gameSettingsService: GameSettingsService,
        private readonly presenceService: PresenceService,
    ) {}

    protected abstract readonly gameId: string;
    protected abstract readonly roundTimeLimit: number;

    onModuleInit(): void {
        this.queueSweep = setInterval(() => this.sweepQueue(), QUEUE_SWEEP_INTERVAL_MS);
    }

    onModuleDestroy(): void {
        if (this.queueSweep)
            clearInterval(this.queueSweep);
        for (const [sessionId, session] of this.sessions)
            this.endSession(sessionId, session);
    }

    handleConnection(client: WebSocket, request: IncomingMessage): void {
        client.pause();
        void this.authenticate(client, request);
    }

    handleDisconnect(client: WebSocket): void {
        for (const [ key, slot] of this.waiting){
            const waiter = slot.find((w) => w.client === client);
            if (waiter)
                this.removeWaiter(key, waiter);
        }

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
    async create(@ConnectedSocket() client: WebSocket): Promise<void> {
        const userid = this.users.get(client);
        if (!userid)
            return this.send(client, 'error', { message: 'not authenticated' });

        const { target, mode, powerUps } = await this.settingsFor(userid);

        if (!this.users.has(client))
            return ;
        if (this.sessionBySocket.has(client))
            return this.send(client, 'error', { message: 'already in a session' });

        if (this.isWaiting(client))
            return this.send(client, 'error', { message: 'already in queue' });

        const sessionId = randomUUID();
        this.sessions.set(sessionId, {
            state: this.matchService.createMatch(target, mode, powerUps),
            a: { userId: userid, client: null, dcTimer: null },
            b: null,
            pending: {},
            roundTimer: null,
            pendingPowerUps: {},
        });
        this.sessionBySocket.set(client, sessionId);
        this.send(client, 'created', { sessionId });
    }

    @SubscribeMessage('queue')
    async queue(@ConnectedSocket() client: WebSocket): Promise<void> {
        const userId = this.users.get(client);
            if (!userId)
                return this.send(client, 'error', { message: 'not authenticated' });
        
        const [settings, level] = await Promise.all([this.settingsFor(userId), this.levelFor(userId)]);
        const key = `${settings.mode}:${settings.target}:${settings.powerUps}`;

        if (!this.users.has(client))
            return ;
        if (this.sessionBySocket.has(client))
            return this.send(client, 'error', { message: 'already in a session' });
        if ( this.isWaiting(client, userId))
            return this.send(client, 'error', { message: 'already in queue' });

        const slot = this.waiting.get(key) ?? [];
        const opponent = this.closestWaiter(slot, level, MATCH_LEVEL_RANGE);
        if (!opponent) {
            slot.push({ client, userId, settings, level, since: Date.now() });
            this.waiting.set(key, slot);
            return this.send(client, 'waiting', { message: 'waiting for an opponent' });
        }
        this.removeWaiter(key, opponent);
        this.startPairedMatch(settings, opponent, { client, userId });
    }
    
    private startPairedMatch(settings: MatchSettings, first: Queued, second: Queued): void {
        const sessionId = randomUUID();
        const session: Session = {
            state: this.matchService.createMatch(settings.target, settings.mode, settings.powerUps),
            a: { userId: first.userId, client: first.client, dcTimer: null },
            b: { userId: second.userId, client: second.client, dcTimer: null },
            pending: {},
            roundTimer: null,
            pendingPowerUps: {},
        };

        this.sessions.set(sessionId, session);
        this.sessionBySocket.set(first.client, sessionId);
        this.sessionBySocket.set(second.client, sessionId);
        this.startRoundTimer(sessionId, session);

        for (const player of [first, second]) {
            this.send(player.client, 'matched', {
                sessionId,
                mode: session.state.mode,
                target: session.state.target,
                powerUps: session.state.powerUps,
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
        this.send(client, 'joined', { mode: session.state.mode, target: session.state.target, powerUps: session.state.powerUps, powerUpsLeft: session.state.powerUpsLeft[side], ...this.viewFor(side, session.state), roundsPlayed: session.state.roundsPlayed });
    }

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
            return this.send(client, 'quit', { message: 'no match' });
        session.state = this.matchService.forfeit(session.state, this.sideOf(session, client)!);
        this.finish(session, this.sessionIdOf(client)!);
    }

    private async settingsFor(userId: string): Promise<MatchSettings> {
        const defaults = DEFAULT_GAME_SETTINGS;

        try {
            const settings = await this.gameSettingsService.settingsFor(userId, this.gameId);
            return settings ? { target: settings.target, mode: settings.mode, powerUps: settings.powerUps } : defaults;
        } catch (error) {
            this.logger.error(`Failed to read game settings for user ${userId}`, error);
            return defaults;
        }
    }

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
            return client.close(4401, 'unauthorized');

        try {
            const payload = await this.jwtService.verifyAsync<{sub: string; type: string; jti: string;}>(token);
            
            if (payload.type !== 'access')
                return client.close(4401, 'unauthorized');
            if (this.denyList.isRevoked(payload.jti))
                return client.close(4401, 'unauthorized');
            if (client.readyState !== WebSocket.OPEN) return;

            this.users.set(client, payload.sub);
            this.presenceService.connect(payload.sub, client);
            client.resume();
            } catch {
                client.close(4401, 'unauthorized');
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

    private isWaiting(client: WebSocket, userId?: string): boolean {
        for (const slot of this.waiting.values()) {
            if (slot.some((waiter) => waiter.client === client || waiter.userId === userId))
                return true;
        }
        return false;
    }
    
    private closestWaiter(slot: Waiter[], level: number, maxGap: number): Waiter | undefined {
        let closest: Waiter | undefined;
        for (const waiter of slot) {
            const gap = Math.abs(waiter.level - level);
            if (gap <= maxGap && (!closest || gap < Math.abs(closest.level - level)))
                closest = waiter;
        }

        return closest;
    }

    private sweepQueue(): void {
        const now = Date.now();
        for (const [key, slot] of this.waiting) {
            for (const waiter of [...slot]) {
                if (!slot.includes(waiter) || now - waiter.since < WIDEN_AFTER_MS)
                    continue ;
                const opponent = this.closestWaiter(slot.filter((w) => w !== waiter), waiter.level, Infinity);
                if (!opponent)
                    continue ;
                this.removeWaiter(key, waiter);
                this.removeWaiter(key, opponent);
                this.startPairedMatch(waiter.settings, opponent, waiter);
            }
        }
    }

    private removeWaiter(key: string, waiter: Waiter): void {
        const slot = this.waiting.get(key);
        if (!slot)
            return ;
        slot.splice(slot.indexOf(waiter), 1);
        if (slot.length === 0)
            this.waiting.delete(key);
    }

    private async levelFor(userId: string): Promise<number> {
        try {
            return await this.gamificationService.levelOf(userId);
        } catch (error) {
            this.logger.error(`Failed to read level for user ${userId}`, error);
            return 0;
        }
    }
}
