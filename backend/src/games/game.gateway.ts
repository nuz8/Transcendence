import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, SubscribeMessage } from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { DenyList } from '../auth/denyList';
import { ScoreEntity, ScoreRepository } from '../scores';
import { MatchService } from './match/match.service';
import type { MatchState } from './match/match.types';
import { Logger, OnModuleDestroy } from '@nestjs/common';

const RECONNECT_TIME_MS = 30_000;

export type Session = { state: MatchState; client: WebSocket | null; userId: string, roundsPlayed: number, dcTimer: NodeJS.Timeout | null};
    
export abstract class GameGateway implements OnModuleDestroy {
    private readonly logger = new Logger(GameGateway.name);
    private readonly users = new Map<WebSocket, string>();
    private readonly sessions = new Map<string, Session>();
    private readonly sessionBySocket = new Map<WebSocket, string>();
    
    constructor(
        protected readonly matchService: MatchService,
        private readonly jwtService: JwtService,
        private readonly denyList: DenyList,
        private readonly scoreRepository: ScoreRepository,
    ) {}

    protected abstract readonly gameId: string;
    protected abstract readonly bestOf: number;

    onModuleDestroy(): void {
        for (const session of this.sessions.values())
            if (session.dcTimer) {
                clearTimeout(session.dcTimer);
                session.dcTimer = null;
            }
    }

    handleConnection(client: WebSocket, request: IncomingMessage): void {
        client.pause();
        void this.authenticate(client, request);
    }

    handleDisconnect(client: WebSocket): void {
        const sessionId = this.sessionBySocket.get(client);
        const session = sessionId ? this.sessions.get(sessionId) : undefined;
        if (session?.client === client && session.roundsPlayed > 0) {
            session.client = null;
            this.sessionBySocket.delete(client);
            session.dcTimer = setTimeout(() => this.dc(sessionId!), RECONNECT_TIME_MS)
        } else if (sessionId) {
            this.sessionBySocket.delete(client);
            this.sessions.delete(sessionId);
        }
        this.users.delete(client);
    }

    @SubscribeMessage('create')
    create(@ConnectedSocket() client: WebSocket): void {
        if (!this.users.has(client))
            return this.send(client, 'error', { message: 'not authenticated' });
        if (this.sessionBySocket.has(client))
            return this.send(client, 'error', { message: 'already in a session' });

        const sessionId = randomUUID();
        this.sessions.set(sessionId, {
            state: this.matchService.createMatch(this.bestOf),
            client: null,
            userId: this.users.get(client)!,
            roundsPlayed: 0,
            dcTimer: null,
        });
        this.sessionBySocket.set(client, sessionId);
        this.send(client, 'created', { sessionId });
    }

    @SubscribeMessage('join')
    join(@ConnectedSocket() client: WebSocket, @MessageBody() sessionId: unknown): void {
        if (!this.users.has(client))
            return this.send(client, 'error', { message: 'not authenticated' });
        const session = typeof sessionId === 'string' ? this.sessions.get(sessionId) : undefined;
        if (!session)
            return this.send(client, 'error', { message: 'unknown session' });
        if (session.client)
            return this.send(client, 'error', { message: 'session already joined' });
        if (session.userId !== this.users.get(client))
            return this.send(client, 'error', { message: 'not your session' });
        if (session.dcTimer) {
            clearTimeout(session.dcTimer);
            session.dcTimer = null;
        }

        session.client = client;
        this.sessionBySocket.set(client, sessionId as string);
        this.send(client, 'joined', { targetRounds: session.state.targetRounds, ownScore: session.state.scoreA, opScore: session.state.scoreB, roundsPlayed: session.roundsPlayed });
    }
    
    @SubscribeMessage('quit')
    quit(@ConnectedSocket() client: WebSocket): void {
        const session = this.currentSession(client);
        if (!session)
            return this.send(client, 'quit', { message: 'no match' });
        session.state = this.matchService.forfeit(session.state, 'a');
        this.finish(client);
    }

    protected finish(client: WebSocket): void {
        const sessionId = this.sessionBySocket.get(client)!;
        const session = this.sessions.get(sessionId)!;
        const { state } = session;

        this.sessions.delete(sessionId);
        this.sessionBySocket.delete(client);

        const outcome = this.matchService.matchOutcome('a', state);

        this.scoreRepository.create(new ScoreEntity({
            sessionId,
            userId: session.userId,
            gameId: this.gameId,
            value: state.scoreA,
            outcome,
            achievedAt: new Date(),
        })).catch((err) => this.logger.error(`failed to save result of session ${sessionId}`, err));

        this.send(client, 'over', {
            outcome,
            ownScore: state.scoreA,
            opScore: state.scoreB,
        });
    }

    private dc(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session || session.client)
            return ;

        this.sessions.delete(sessionId);

        const state = this.matchService.forfeit(session.state, 'a');

        this.scoreRepository.create(new ScoreEntity({
            sessionId,
            userId: session.userId,
            gameId: this.gameId,
            value: state.scoreA,
            outcome: this.matchService.matchOutcome('a', state),
            achievedAt: new Date(),
        })).catch((err) => this.logger.error(`failed to save the forfeit of session ${sessionId}`, err));
    }

    private async authenticate(client: WebSocket, request: IncomingMessage): Promise<void> {
        const [ type, token] = request.headers.authorization?.split(' ') ?? [];
        if (type !== 'Bearer' || !token)
            return client.close(4401, 'unauthorized');

        try {
            const payload = await this.jwtService.verifyAsync<{sub: string; type: string; jti: string;}>(token);
            
            if (payload.type !== 'access')
                return client.close(4401, 'unauthorized');
            if (this.denyList.isRevoked(payload.jti))
                return client.close(4401, 'unauthorized');

            this.users.set(client, payload.sub);
            client.resume();
            } catch {
                client.close(4401, 'unauthorized');
            }
        }

    protected currentSession(client: WebSocket): Session | undefined {
        const sessionId = this.sessionBySocket.get(client);
        const session = sessionId ? this.sessions.get(sessionId) : undefined;
        return session?.client === client ? session : undefined;
    }


    protected send(client: WebSocket, event: string, data: unknown): void {
        if (client.readyState !== WebSocket.OPEN)
            return ;

        client.send(JSON.stringify({ event, data }));
    }
}