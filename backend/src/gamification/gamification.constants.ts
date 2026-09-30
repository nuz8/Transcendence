/**
 * Minimum XP required to reach each level (Index = Level).
 * Formula: ceil(5 * 1.42^(N-1)) for N >= 1
 * Level 0: 0 XP
 * Level 1: 5 XP (ceil(5 * 1.42^0))
 * Level 2: 8 XP (ceil(5 * 1.42^1))
 * ...
 * Level 20: 3913 XP
*/
export const LEVEL_THRESHOLDS = [
  0,    // Level 0
  5,    // Level 1
  8,    // Level 2
  11,   // Level 3
  15,   // Level 4
  21,   // Level 5
  29,   // Level 6
  41,   // Level 7
  59,   // Level 8
  83,   // Level 9
  118,  // Level 10
  167,  // Level 11
  237,  // Level 12
  337,  // Level 13
  478,  // Level 14
  678,  // Level 15
  963,  // Level 16
  1367, // Level 17
  1941, // Level 18
  2756, // Level 19
  3913, // Level 20
] as const;

export const MAX_PRECALCULATED_LEVEL = 20;

const BASE_XP = 5;
const XP_MULTIPLIER = 1.42;
const LOG_MULTIPLIER = Math.log(XP_MULTIPLIER);

/**
 * Fn to calculate the exact minimum XP threshold for level N using ceil(5 * 1.42^(N-1)).
*/
export function calculateLevelThreshold(level: number): number {
  if (level <= 0) return 0;
  return Math.ceil(BASE_XP * Math.pow(XP_MULTIPLIER, level - 1));
}

/**
 * Fn to determine which level a given XP amount falls into.
 * - Under 5 XP -> Level 0
 * - Level 1 to 20: Table lookup against LEVEL_THRESHOLDS
 * - Beyond Level 20: O(1) logarithmic inversion with threshold verification
 */
export function getLevelFromXp(xp: number): number {
  // Level = 0 for xp < 5
  if (xp < LEVEL_THRESHOLDS[1]) {
    return 0;
  }

  // Pre-calculated table lookup for levels 1 to 20
  if (xp <= LEVEL_THRESHOLDS[MAX_PRECALCULATED_LEVEL]) {
    for (let level = MAX_PRECALCULATED_LEVEL; level >= 1; level--) {
      if (xp >= LEVEL_THRESHOLDS[level]) {
        return level;
      }
    }
    return 0;
  }

  // O(1) logarithmic calculation for levels beyond 20:
  // Formula derivation: xp >= 5 * 1.42^(N-1) ==>> N <= 1 + ln(xp/5) / ln(1.42)
  let n = Math.floor(1 + Math.log(xp / BASE_XP) / LOG_MULTIPLIER);

  // Guard against floating-point precision drift around ceiling boundaries
  if (xp < calculateLevelThreshold(n)) {
    return n - 1;
  }
  if (xp >= calculateLevelThreshold(n + 1)) {
    return n + 1;
  }
  
  return n;
}