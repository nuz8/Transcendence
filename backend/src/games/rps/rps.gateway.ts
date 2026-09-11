import { ConnectedSocket, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, MessageBody, OnGatewayConnection } from '@nestjs/websockets';
import { WebSocket } from 'ws';
import { RpsService } from './rps.service';
import { JwtService } from '@nestjs/jwt';
import { DenyList } from '../../auth/denyList';
import { ScoreRepository } from '../../scores';
import { RPS_GAME_ID } from './rps.constants';
import { GameGateway } from '../game.gateway';

const BEST_OF = 3;
@WebSocketGateway({ path: '/games/rps' })
export class RpsGateway extends GameGateway implements OnGatewayConnection, OnGatewayDisconnect  {
    protected readonly gameId = RPS_GAME_ID;
    protected readonly bestOf = BEST_OF;

    constructor(
        private readonly rpsService: RpsService,
        jwtService: JwtService,
        denyList: DenyList,
        scoreRepository: ScoreRepository,
    ) {
        super(rpsService, jwtService, denyList, scoreRepository);
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
        session.roundsPlayed += 1;

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

}
