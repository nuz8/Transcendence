import { Player } from "../match/match.types";

export type Mark = 'X' | 'O';         // The marks used by players/clients mark cells. Clients never see the internal a/b seats nomenclature

export type Cell = Player | null;     // One cell in a board: the player/seat that marked it or owns it, or null when empty

export type Board = readonly Cell[];  // Represents the 9 cells in a row-major order: readonly because every move produces a new board

export type TttState = {              // Pre-session game state: is stored in Session.game and resets between rounds
  board: Board;
  turn: Player;                         // Seat that must move next
  firstStarter: Player;                 // Seat that started round 1
};

export type { MatchState, Outcome, Player } from '../match/match.types'