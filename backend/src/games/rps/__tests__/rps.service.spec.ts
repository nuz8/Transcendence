import { RpsService } from '../rps.service';

describe('RpsService', () => {
  const rps = new RpsService();

  it('resolves a round by the beats table', () => {
    expect(rps.play('rock', 'scissors').winner).toBe('a');
    expect(rps.play('rock', 'paper').winner).toBe('b');
    expect(rps.play('rock', 'rock').winner).toBeNull();
  });

  it('reports the outcome from a given player perspective', () => {
    const round = rps.play('rock', 'scissors');
    expect(rps.outcomeFor('a', round)).toBe('win');
    expect(rps.outcomeFor('b', round)).toBe('lose');
    expect(rps.outcomeFor('a', rps.play('rock', 'rock'))).toBe('draw');
  });

  it('parses full names and single letters, and rejects anything else', () => {
    expect(rps.parseMove('  PAPER ')).toBe('paper');
    expect(rps.parseMove('s')).toBe('scissors');
    expect(rps.parseMove('lizard')).toBeNull();
  });

  it('rejects an even bestOf', () => {
    expect(() => rps.createMatch(4)).toThrow();
    expect(rps.createMatch(5).targetRounds).toBe(3);
  });

  it('scores only the winner of a round', () => {
    const start = rps.createMatch(5);
    const won = rps.playRound(start, 'rock', 'scissors').state;
    expect([won.scoreA, won.scoreB]).toEqual([1, 0]);

    const drawn = rps.playRound(won, 'rock', 'rock').state;
    expect([drawn.scoreA, drawn.scoreB]).toEqual([1, 0]);
  });

  it('ends the match when a player reaches the target', () => {
    let state = rps.createMatch(3);
    expect(rps.gameOver(state)).toBe(false);

    state = rps.playRound(state, 'rock', 'scissors').state;
    state = rps.playRound(state, 'rock', 'scissors').state;

    expect(rps.gameOver(state)).toBe(true);
    expect(rps.matchOutcome('a', state)).toBe('win');
    expect(rps.matchOutcome('b', state)).toBe('lose');
  });

  it('ends the match on a forfeit and hands the win to the other player', () => {
    const state = rps.forfeit(rps.createMatch(5), 'a');

    expect(rps.gameOver(state)).toBe(true);
    expect(rps.matchWinner(state)).toBe('b');
    expect(rps.matchOutcome('a', state)).toBe('forfeit');
    expect(rps.matchOutcome('b', state)).toBe('win');
  });
});