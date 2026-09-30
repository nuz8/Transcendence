import {
  LEVEL_THRESHOLDS,
  getLevelFromXp,
  calculateLevelThreshold,
} from '../gamification.constants';

describe('Gamification Level Logic', () => {
  it('correctly matches precalculated thresholds for levels 1 to 20', () => {
    for (let lvl = 1; lvl <= 20; lvl++) {
      expect(LEVEL_THRESHOLDS[lvl]).toBe(calculateLevelThreshold(lvl));
    }
  });

  it('assigns level 0 for XP below 5', () => {
    expect(getLevelFromXp(0)).toBe(0);
    expect(getLevelFromXp(1)).toBe(0);
    expect(getLevelFromXp(4)).toBe(0);
  });

  it('promotes to level 1 at 5 XP (first game loss/win target)', () => {
    expect(getLevelFromXp(5)).toBe(1);
    expect(getLevelFromXp(7)).toBe(1);
  });

  it('promotes to level 2 at 8 XP', () => {
    expect(getLevelFromXp(8)).toBe(2);
    expect(getLevelFromXp(10)).toBe(2);
  });

  it('accurately resolves boundaries up to level 20', () => {
    expect(getLevelFromXp(3912)).toBe(19);
    expect(getLevelFromXp(3913)).toBe(20);
  });

  it('accurately resolves levels beyond 20 using logarithmic calculation', () => {
    const lvl21Threshold = calculateLevelThreshold(21); // 5557
    expect(getLevelFromXp(lvl21Threshold - 1)).toBe(20);
    expect(getLevelFromXp(lvl21Threshold)).toBe(21);

    const lvl50Threshold = calculateLevelThreshold(50);
    expect(getLevelFromXp(lvl50Threshold - 1)).toBe(49);
    expect(getLevelFromXp(lvl50Threshold)).toBe(50);
  });
});