import { MatchService } from '../match.service';
import type { MatchState, Player, PowerUp } from '../match.types';

describe('MatchService', () => {
  const match = new MatchService();

  const play = (state: MatchState, rounds: (Player | null)[]) =>
    rounds.reduce((s, winner) => match.recordRound(s, winner), state);

  it('accepts any whole target from 1, even ones, and nothing else', () => {
     expect(match.createMatch(4, 'fixed-target-score').target).toBe(4);
     expect(() => match.createMatch(0, 'fixed-rounds')).toThrow();
     expect(() => match.createMatch(2.5, 'fixed-rounds')).toThrow();
  });

  describe('fixed-rounds', () => {
    it('ends after the target number of rounds, drawn when the score is equal', () => {
      const state = play(match.createMatch(4, 'fixed-rounds'), ['a', 'b', null, null]);

      expect(match.gameOver(state)).toBe(true);
      expect(match.matchOutcome('a', state)).toBe('draw');
      expect(match.matchOutcome('b', state)).toBe('draw');
    });

    it('gives the match to the higher score after the last round', () => {
      const state = play(match.createMatch(3, 'fixed-rounds'), [null, 'b', null]);

      expect(match.gameOver(state)).toBe(true);
      expect(match.matchOutcome('b', state)).toBe('win');
      expect(match.matchOutcome('a', state)).toBe('lose');
    });

    it('ends early once the leader cannot be caught', () => {
      const state = play(match.createMatch(5, 'fixed-rounds'), ['a', 'a', 'a']);

      expect(match.gameOver(state)).toBe(true);
      expect(match.matchWinner(state)).toBe('a');
    });
  });

  describe('power-ups', () => {
    const withPowerUps = (mode: 'fixed-target-score' | 'fixed-rounds', target: number) =>
      match.createMatch(target, mode, true);
    const round = (state: MatchState, winner: Player | null, played: Partial<Record<Player, PowerUp>>) =>
      match.recordRound(state, winner, played);

    it('gives each side one shield and one double only when they are on', () => {
      expect(match.createMatch(3, 'fixed-rounds').powerUpsLeft).toEqual({ a: [], b: [] });
      expect(withPowerUps('fixed-rounds', 3).powerUpsLeft).toEqual({ a: ['shield', 'double'], b: ['shield', 'double'] });
    });

    it('a double makes a won round worth 2, and is used up', () => {
      const state = round(withPowerUps('fixed-target-score', 3), 'a', { a: 'double' });

      expect([state.scoreA, state.scoreB]).toEqual([2, 0]);
      expect(state.powerUpsLeft.a).toEqual(['shield']);
    });

    it('a double on a lost or drawn round scores nothing and is still used up', () => {
      const state = round(withPowerUps('fixed-target-score', 3), 'b', { a: 'double' });

      expect([state.scoreA, state.scoreB]).toEqual([0, 1]);
      expect(state.powerUpsLeft.a).toEqual(['shield']);
    });

    it('a shield makes the round a draw, whoever wins it, even against a double', () => {
      const lost = round(withPowerUps('fixed-target-score', 3), 'b', { a: 'shield' });
      expect([lost.scoreA, lost.scoreB]).toEqual([0, 0]);

      const won = round(withPowerUps('fixed-target-score', 3), 'a', { a: 'shield' });
      expect([won.scoreA, won.scoreB]).toEqual([0, 0]);

      const both = round(withPowerUps('fixed-target-score', 3), 'b', { a: 'shield', b: 'double' });
      expect([both.scoreA, both.scoreB]).toEqual([0, 0]);
      expect(both.powerUpsLeft).toEqual({ a: ['double'], b: ['shield'] });
    });

    it('counts an unused double when deciding if the leader can be caught', () => {
      const held = play(withPowerUps('fixed-rounds', 3), ['a', 'a']);
      expect(match.gameOver(held)).toBe(false);

      const caught = round(held, 'b', { b: 'double' });
      expect(match.gameOver(caught)).toBe(true);
      expect(match.matchOutcome('a', caught)).toBe('draw');
    });
  });

  it('scores only the winner of a round', () => {
    const start = match.createMatch(3, 'fixed-target-score');
    const won = match.recordRound(start, 'a');
    expect([won.scoreA, won.scoreB]).toEqual([1, 0]);

    const drawn = match.recordRound(won, null);
    expect([drawn.scoreA, drawn.scoreB]).toEqual([1, 0]);
  });

  it('ends the match when a player reaches the target', () => {
    let state = match.createMatch(2, 'fixed-target-score');
    expect(match.gameOver(state)).toBe(false);

    state = match.recordRound(state, 'a');
    state = match.recordRound(state, 'a');

    expect(match.gameOver(state)).toBe(true);
    expect(match.matchOutcome('a', state)).toBe('win');
    expect(match.matchOutcome('b', state)).toBe('lose');
  });

  it('keeps a fixed-target-score match going until someone reaches the target, however many draws', () => {
     let state = match.createMatch(2, 'fixed-target-score');
     for (const winner of [null, 'a', null] as const)
       state = match.recordRound(state, winner);
 
     expect(match.matchWinner(state)).toBeNull();
     expect(match.gameOver(state)).toBe(false);
 
     state = match.recordRound(state, 'a');
     expect(match.matchWinner(state)).toBe('a');
   });

  it('ends the match on a forfeit and hands the win to the other player', () => {
    const state = match.forfeit(match.createMatch(3, 'fixed-target-score'), 'a');

    expect(match.gameOver(state)).toBe(true);
    expect(match.matchWinner(state)).toBe('b');
    expect(match.matchOutcome('a', state)).toBe('forfeit');
    expect(match.matchOutcome('b', state)).toBe('win');
  });
});
