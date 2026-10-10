import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";
import { WebSocket } from 'ws';
import { GameGateway, Session } from "../game.gateway";
import { MARK_OF, TTT_GAME_ID, TTT_TURN_TIME_LIMIT_MS } from "./tictactoe.constants";
import { TicTacToeService } from "./tictactoe.service";
import { MatchService } from "../match/match.service";
import { ScoreService } from "../../scores";
import { GamificationService } from "../../gamification";
import { GameSettingsService } from "../settings/game-settings.service";
import { PresenceService } from "../../presence";
import { SocketAuthenticator } from "../../auth/socketAuthenticator";
import { Player, TttState } from "./tictactoe.types";
import { ActiveMatchService } from "../gateway-utils/active-match.service";

@WebSocketGateway({ path: '/games/tictactoe' })
export class TicTacToeGateway extends GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  protected readonly gameId = TTT_GAME_ID;
  protected readonly roundTimeLimit = TTT_TURN_TIME_LIMIT_MS; // The base-class round timer doubles as the per-turn timer
  protected override readonly allowSolo = false;  // Only supports PvP mode for now, to be flipped to false if bod mode is added
  protected override readonly supportsPowerUps = false; // No support for power-ups for now

  constructor(
    private readonly tttService: TicTacToeService,
    matchService: MatchService,
    socketAuthenticator: SocketAuthenticator,
    scoreService: ScoreService,
    gamificationService: GamificationService,
    gameSettingsService: GameSettingsService,
    presenceService: PresenceService,
    activeMatchService: ActiveMatchService,

  ) {
    super(matchService, socketAuthenticator,
      scoreService, gamificationService,
      gameSettingsService, presenceService, activeMatchService);
  }

  // Method called by the base class when a session is created: empty board plus a random first starter
  protected override newGameState(): TttState {
    return this.tttService.createState();
  }

  // Typed access to TicTacToe's state inside a generic Session
  private gameOf(session: Session): TttState {
    return session.game as TttState;
  }

  // Per-player fields added to 'matched' / 'joined': enough to redraw the game after a reconnect
  protected override sessionExtras(side: Player, session: Session): Record<string, unknown> {
    const game = this.gameOf(session);
    return {
      symbol: MARK_OF[side],
      board: this.tttService.transformToMarks(game.board),
      yourTurn: game.turn === side,
      turnTimeMs: this.roundTimeLimit,
    };
  }

  // Method to handle 'move' message: validates, then hands over to applyMove()
  @SubscribeMessage('move')
  move(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: unknown
  ): void {
    const session = this.currentSession(client);
    if (!session)
      return this.send(client, 'error', { message: 'not in a session' });
    // Double guard against bot mode despite allowSolo=false
    if (!session.b)
      return this.send(client, 'error', { message: 'waiting for an opponent' });

    const cell = this.tttService.parseCell(body);
    if (cell === null)
      return this.send(client, 'error', { message: 'not a valid cell (0-8)' });

    const game = this.gameOf(session);
    const side = this.sideOf(session, client)!;
    if (game.turn !== side)
      return this.send(client, 'error', { message: 'not your turn' });
    if (!this.tttService.isFree(game.board, cell))
      return this.send(client, 'error', { message: 'cell already taken' });

    this.applyMove(session, this.sessionIdOf(client)!, side, cell);
  }

  // Core move engine; independent of who moves, so that even a future bot can all it directly
  private applyMove(
    session: Session,
    sessionId: string,
    side: Player,
    cell: number
  ): void {
    const game = this.gameOf(session);
    game.board = this.tttService.place(game.board, cell, side); // place the move from the side

    const winner = this.tttService.winnerOf(game.board);  // get the winner if there is one from the current move
    if (winner !== null || this.tttService.isFull(game.board))  // check if round ended (from a winner of full board)
      return this.endRound(session, sessionId, winner);

    // Round continues: pass the turn and restart the per-turn clock before reporting the time left
    game.turn = this.tttService.opponentOf(side);
    this.startRoundTimer(session);
    this.broadcast(session, 'moved', (seat) => ({
      board: this.tttService.transformToMarks(game.board),
      lastCell: cell,
      yourTurn: game.turn === seat,
      roundTimeLeft: session.clock.timeLeft(),
    }));
  }

  // Scores a finished board (win or draw), then starts the next round or ends the match
  private endRound(session: Session,
    sessionId: string,
    winner: Player | null
  ): void {
    const game = this.gameOf(session);
    const finishedBoard = this.tttService.transformToMarks(game.board);

    session.state = this.matchService.recordRound(session.state, winner);
    const over = this.matchService.gameOver(session.state);
    
    // Next round: empty board, alternating starter, fresh clock (skipped when the match is over)
    if (!over) {
      game.board = this.tttService.emptyBoard();
      game.turn = this.tttService.startingPlayer(game.firstStarter, session.state.roundsPlayed);
      this.startRoundTimer(session);
    }

    this.broadcast(session, 'round', (seat) => ({
      board: finishedBoard,
      outcome: this.tttService.outcomeFor(seat, winner),
      yourTurn: !over && game.turn === seat,
      roundsPlayed: session.state.roundsPlayed,
      ...this.viewFor(seat, session.state),
      roundTimeLeft: over ? null : session.clock.timeLeft(),
    }));

    // finish() sends 'over', saves the scores and ends the session
    if (over)
      this.finish(session, sessionId);
  }

  /**
   * Replaces the RPS "nobody moved" rule: whoever's turn it is forfeits when the clock runs out
   */
  protected override roundExpired(sessionId: string): void {
    const session = this.sessionById(sessionId);
    if (!session)
      return;

    session.state = this.matchService.forfeit(session.state, this.gameOf(session).turn);
    this.finish(session, sessionId);
  }

  /**
   * Sends one event to every connected seat, with a tailored payload per seat
   */
  private broadcast(
    session: Session,
    event: string,
    payloadFor: (side: Player) => object
  ): void {
    for (const side of this.sides(session)) {
      const client = side === 'a' ? session.a.client : session.b!.client;
      if (client)
        this.send(client, event, payloadFor(side));
    }
  }
}
