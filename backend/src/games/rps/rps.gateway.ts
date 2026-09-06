import { ConnectedSocket, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, MessageBody } from '@nestjs/websockets';
import { WebSocket } from 'ws';
import { RpsService } from './rps.service';
import type { MatchState } from './rps.types';
import { randomUUID } from 'node:crypto';

const BEST_OF = 3;

type Session = { state: MatchState; client: WebSocket | null};

@WebSocketGateway({ path: '/games/rps' })
export class RpsGateway implements OnGatewayDisconnect {
    // TODO: issue: in-memory only sessions are lost if the server restarts
    // needs to  be recoverable
    private readonly sessions = new Map<string, Session>();
    private readonly sessionBySocket = new Map<WebSocket, string>();

    constructor(private readonly rpsService: RpsService) {}

    handleDisconnect(client: WebSocket): void {
        const sessionId = this.sessionBySocket.get(client);
        if (!sessionId)
            return ;

        this.sessionBySocket.delete(client);
        this.sessions.delete(sessionId);
    }

    @SubscribeMessage('create')
    create(@ConnectedSocket() client: WebSocket): void {
        const sessionId = randomUUID();
        this.sessions.set(sessionId, { state: this.rpsService.createMatch(BEST_OF), client: null });
        this.sessionBySocket.set(client, sessionId);
        this.send(client, 'created', { sessionId });
    }

    @SubscribeMessage('join')
    join(@ConnectedSocket() client: WebSocket, @MessageBody() sessionId: unknown): void {
        const session = typeof sessionId === 'string' ? this.sessions.get(sessionId) : undefined;
        if (!session)
            return this.send(client, 'error', { message: 'unknown session' });
        if (session.client)
            return this.send(client, 'error', { message: 'session already joined' });

        session.client = client;
        this.sessionBySocket.set(client, sessionId as string);
        this.send(client, 'joined', { targetRounds: session.state.targetRounds });
    }

    @SubscribeMessage('move')
    move(@ConnectedSocket() client: WebSocket, @MessageBody() body: unknown): void {
        const session = this.currentSession(client);
        if (!session)
            return this.send(client, 'error', { message: 'join first' });

        const  move = this.rpsService.parseMove(String(body ?? ''));
        if (!move)
            return this.send(client, 'error', { message: 'not a move' });

        const played = this.rpsService.playRound(session.state, move, this.rpsService.randomMove());
        session.state = played.state;

        this.send(client, 'round', { 
            ownMove: played.round.moveA,
            opMove: played.round.moveB,
            outcome: this.rpsService.outcomeFor('a', played.round),
            ownScore: played.state.scoreA,
            opScore: played.state.scoreB, 
        });

        if (this.rpsService.gameOver(played.state))
            this.finish(client);
    }

    @SubscribeMessage('quit')
    quit(@ConnectedSocket() client: WebSocket): void {
        const session = this.currentSession(client);
        if (!session)
            return this.send(client, 'quit', { message: 'no match' });
        session.state = this.rpsService.forfeit(session.state, 'a');
        this.finish(client);
    }

    private finish(client: WebSocket): void {
        const sessionId = this.sessionBySocket.get(client)!;
        const { state } = this.sessions.get(sessionId)!;

        this.sessions.delete(sessionId);
        this.sessionBySocket.delete(client);
        this.send(client, 'over', {
            outcome: this.rpsService.matchOutcome('a', state),
            ownScore: state.scoreA,
            opScore: state.scoreB,
        });
    }

    private send(client: any, event: string, data: unknown): void {
        client.send(JSON.stringify({ event, data }));
    }

    private currentSession(client: WebSocket): Session | undefined {
        const sessionId = this.sessionBySocket.get(client);
        const session = sessionId ? this.sessions.get(sessionId) : undefined;
        return session?.client === client ? session : undefined;
    }

}
