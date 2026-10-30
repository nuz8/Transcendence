import type { Player } from "../match/match.types";

// A claim: "there are at least `quantity` dice showing `face` across both hands".
export type Bid = { quantity: number; face: number };

//  Server-side state of one dice game (until someone hits 0 dice); never sent whole to a client.
export type DiceGame = {
  hands: Record<Player, number[]>;  // both players' hidden dice; their length is each player's dice count
  bid: Bid | null;  //  standing bid this round, null until someone opens
  turn: Player; // whose action (bid/challenge) is expected next
  started: boolean; // true when the first bid of the whole match (not just a round) is placed
  tally: Record<Player, number>;  // remaining dice summed over the dice games that each side won
};

// Outcome of a challenge: how many dice matched the bid's face and who loses a die
export type ChallengeResult = { count: number; loser: Player };

// Outcome of losing a die: the next game state, dice left per side, and the dice-game winner if someone hit 0
export type LossResult = {
  game: DiceGame;
  left: Record<Player, number>;
  gameWinner: Player | null;
};

// The only two things a player can do on their turn; a future bot would produce the same actions
export type Action = { type: 'bid'; bid: Bid } | { type: 'challenge' };

export type { MatchState, Outcome, Player } from '../match/match.types';