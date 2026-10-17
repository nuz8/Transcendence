import { Mark, Player } from "./tictactoe.types";

export const TTT_GAME_ID = '7c2d9e41-5a3b-4f68-9b1e-2d8a6c4f0e53';  // Fixed UUID so the games-table row has the same id in every environment.
export const TTT_GAME_NAME = 'Tic Tac Toe';
export const TTT_TURN_TIME_LIMIT_MS = 30_000; // Per-turn time limit; designed to be changeable only from here
export const TTT_ROUND_REVIEW_MS = 3_000; // How long the finished board stays on screen before the next round clears it
export const BOARD_SIZE = 9;  // 3x3 board, flattened to 9 cells (index = row * 3 + col).
export const WIN_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];  // The 8 win patterns/lines as cell indices (row-major order): 

export const MARK_OF: Record<Player, Mark> = { a: 'X', b: 'O' };  // Seat 'a' is set to be 'X' and 'b' as 'O'