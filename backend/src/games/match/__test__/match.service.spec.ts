import { MatchService } from '../match.service';

describe('MatchService', () => {
  const match = new MatchService();

  it('rejects an even bestOf', () => {
    expect(() => match.createMatch(4)).toThrow();
    expect(match.createMatch(5).targetRounds).toBe(3);
  });

  it('scores only the winner of a round', () => {
    const start = match.createMatch(5);
    const won = match.recordRound(start, 'a');
    expect([won.scoreA, won.scoreB]).toEqual([1, 0]);

    const drawn = match.recordRound(won, null);
    expect([drawn.scoreA, drawn.scoreB]).toEqual([1, 0]);
  });

  it('ends the match when a player reaches the target', () => {
    let state = match.createMatch(3);
    expect(match.gameOver(state)).toBe(false);

    state = match.recordRound(state, 'a');
    state = match.recordRound(state, 'a');

    expect(match.gameOver(state)).toBe(true);
    expect(match.matchOutcome('a', state)).toBe('win');
    expect(match.matchOutcome('b', state)).toBe('lose');
  });

  it('ends the match on a forfeit and hands the win to the other player', () => {
    const state = match.forfeit(match.createMatch(5), 'a');

    expect(match.gameOver(state)).toBe(true);
    expect(match.matchWinner(state)).toBe('b');
    expect(match.matchOutcome('a', state)).toBe('forfeit');
    expect(match.matchOutcome('b', state)).toBe('win');
  });
});