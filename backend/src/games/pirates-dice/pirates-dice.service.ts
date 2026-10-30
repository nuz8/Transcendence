import { Injectable } from "@nestjs/common";
import { Bid, ChallengeResult, DiceGame, LossResult, Player } from "./pirates-dice.types";
import { randomInt } from "node:crypto";
import { FACES, STARTING_DICE } from "./pirates-dice.constants";
import tr from "zod/v4/locales/tr.js";

@Injectable()
export class PiratesDiceService {
  // Turn handling: in a 1v1 the other seat is always the opponent
  opponentOf(side: Player): Player {
    return side === 'a' ? 'b' : 'a';
  }

  // Decides who opens the very first round (rule: random for round 1)
  randomSide(): Player {
    return randomInt(2) === 0 ? 'a' : 'b';
  }

  // Rolls 'count' number of dice, server-side, so clients cannot cheat; values can be 1 to 'FACES'
  roll(count: number): number[] {
    return Array.from({ length: count }, () => randomInt(1, FACES + 1));
  }

  /**
   * Starts a fresh dice game: both players get 5 (STARTING_DICE) new dice, and the 'starter' opens
   * 'carry' keeps the match-level data (score tally, 'first bid placed') across the dice games
   */
  newGame(
    starter: Player,
    carry: Pick<DiceGame, 'tally' | 'started'> = { tally: { a: 0, b: 0 }, started: false },
  ): DiceGame {
    return {
      hands: { a: this.roll(STARTING_DICE), b: this.roll(STARTING_DICE) },
      bid: null,
      turn: starter,
      started: carry.started,
      tally: { ...carry.tally },
    };
  }

  // Turns untrusted client input into a well-formed bid (integer quantity >= 1, face 1-6) or null
  parseBid(input: unknown): Bid | null {
    if (typeof input !== 'object' || input === null) // typeof null is 'object' in JS, hence needs to be checked explicitly
      return null;
    const { quantity, face } = input as Record<string, unknown>;
    if (typeof quantity !== 'number' || typeof face !== 'number')
      return null;
    if (!Number.isInteger(quantity) || !Number.isInteger(face))
      return null;
    if (quantity < 1 || face < 1 || face > FACES)
      return null;
    return { quantity, face };
  }

  /**
   * Method to check whether a proposed bid is allowed by the game's bidding rules.
   * If next.quantity > number of dice still in play: rejects the bid
   * If current === null, there is no bid to raise: any bid within the dice limit is accepted
   * Otherwise, new bid must either:
   *  - increase the quantity (any face allowed), or
   *  - keep same quantity but increase the face value.
   * Example: if current bid === 3 fours
   *  - valid: 4 twos, 3 fives
   *  - invalid: 3 threes, 2 sixes
   * @param current the standing bid, or null for the opening bid of a round
   * @param next the bid the player wants to make
   * @param totalDice dice currently in play across both hands
   * @returns true if the bid is a legal raise
   */
  isValidBid(current: Bid | null, next: Bid, totalDice: number): boolean {
    if (next.quantity > totalDice)
      return false;
    if (!current)
      return true;
    return next.quantity > current.quantity
      || (next.quantity === current.quantity && next.face > current.face);
  }

  // Counts dice showing 'face' across both hands; the only place wild 1s would plug is later
  countFace(hands: DiceGame['hands'], face: number): number {
    return [...hands.a, ...hands.b].filter((die) => die === face).length;
  }

  // Records a validated bid: it becomes the standing bid, the turn passes, and the match counts as started
  placeBid(game: DiceGame, bid: Bid): DiceGame {
    return { ...game, bid, turn: this.opponentOf(game.turn), started: true };
  }

  /**
   * Judges a challenge. The player on turn is the challenger, the opponent made the standing bid.
   * Count >= bid means the bid was true, so the challenger loses a die; otherwise the bidder loses a die.
   */
  resolveChallenge(game: DiceGame): ChallengeResult {
    const bid = game.bid!;
    const count = this.countFace(game.hands, bid.face);
    const challenger = game.turn;
    return { count, loser: count >= bid.quantity ? challenger: this.opponentOf(challenger) };
  }

  /**
   * Applies a lost die (from a challenge or a turn timeout).
   * Dice remain: re-roll, no bid, and the loser opens the next round.
   * Loser hits 0 dice: the opponent wins the dice game and their remaining dice are added to their tally (their score).
   */
  resolveLoss(game: DiceGame, loser: Player): LossResult {
    const left = { a: game.hands.a.length, b: game.hands.b.length };
    left[loser] -= 1;

    if (left[loser] > 0) {
      return {
        game: { ...game, hands: { a: this.roll(left.a), b: this.roll(left.b) }, bid: null, turn: loser },
        left,
        gameWinner: null,
      };
    }

    const winner = this.opponentOf(loser);
    return {
      game: { ...game, tally: { ...game.tally, [winner]: game.tally[winner] + left[winner] } },
      left,
      gameWinner: winner,
    };
  }
}