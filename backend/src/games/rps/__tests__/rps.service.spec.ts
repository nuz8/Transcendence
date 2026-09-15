import { RpsService } from '../rps.service';
import { MatchService } from '../../match/match.service';

describe('RpsService', () => {
  const rps = new RpsService(new MatchService());

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
});