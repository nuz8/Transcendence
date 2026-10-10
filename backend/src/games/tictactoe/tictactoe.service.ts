import { Injectable } from "@nestjs/common";
import { BOARD_SIZE, MARK_OF, WIN_LINES } from "./tictactoe.constants";
import { Board, Mark, Outcome, Player, TttState } from "./tictactoe.types";
import { randomInt } from "crypto";

@Injectable()
export class TicTacToeService {

  // Method to return a fresh board with empty cells
  emptyBoard(): Board {
    return Array<null>(BOARD_SIZE).fill(null);
  }

  // Method to build the state for a new session, picking the first starter at random
  createState(): TttState {
    const firstStarter: Player = randomInt(2) === 0 ? 'a' : 'b';
    return {
      board: this.emptyBoard(),
      turn: firstStarter,
      firstStarter,
    };
  }

  // Method that returns the other seat
  opponentOf(player: Player): Player {
    return player === 'a' ? 'b' : 'a';
  }

  // Method to return who starts current round: the opposite seat of the firstStarter starts the even rounds
  startingPlayer(firstStarter: Player, roundsPlayed: number): Player {
    return roundsPlayed % 2 === 0 ? firstStarter : this.opponentOf(firstStarter);
  }

  /**
   * Method that accepts text input like 4 or "4" and convertes them to valid index
   * Returns the valid cell index between 0 and 8 if input is valid
   * Returns null for invalid input
   */
  parseCell(input: unknown): number | null {
    const value = 
      typeof input === 'string' && /^\d$/.test(input.trim())
        ? Number(input)
        : input;
    return typeof value === 'number'
        && Number.isInteger(value)
        && value >= 0
        && value < BOARD_SIZE
      ? value
      : null;
  }

  /**
   * Method to check that a cell is empty
   * 'cell' must be an already validated index
   */
  isFree(board: Board, cell: number): boolean {
    return board[cell] === null;
  }

  /**
   * Method to return a new Board in the current state with the player's mark in the chosen cell
   * isFree() must first be called to check that the cell being marked is empty
   */
  place(board: Board, cell: number, player: Player): Board {
    return board.map((currentCell, index) => (
      index === cell ? player : currentCell
    ));
  }

  /**
   * Returns the seat that owns a complete line
   * Returns null if nobody has won it yet
   */ 
  winnerOf(board: Board): Player | null {
    for (const [x, y, z] of WIN_LINES) {
      if (board[x] !== null && board[x] === board[y] && board[x] === board[z])
        return board[x];
    }
    return null;
  }

  /**
   * Method that returns true when the board is full
   * No more moves are possible, therefore this means a draw
   */
  isFull(board: Board): boolean {
    return board.every((cell) => cell !== null);
  }

  /**
   * Returns the outcome from a player's POV, returns draw if winner is null 
  */
  outcomeFor(player: Player, winner: Player | null): Outcome {
    if (winner === null)
      return 'draw';
    return winner == player ? 'win' : 'lose';
  }

  /**
   * Method to return a random empty cell or null if full (for future bot plug-in)
   */
  pickRandomFreeCell(board: Board): number | null {
    const free = board.flatMap((cell, index) => (
      cell === null
      ? [index]
      : []
    ));
    return free.length === 0
      ? null
      : free[randomInt(free.length)];
  }

  transformToMarks(board: Board): (Mark | null)[] {
    return board.map((cell) => (
      cell === null ? null : MARK_OF[cell]
    ));
  }
}