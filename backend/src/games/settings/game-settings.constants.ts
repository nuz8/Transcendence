import { MATCH_MODES, type MatchMode } from '../match/match.types';

export const TARGET_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const GAME_THEMES = ['default', 'extra'] as const;
export type GameTheme = (typeof GAME_THEMES)[number];

export const DEFAULT_GAME_SETTINGS: { target: number; mode: MatchMode; theme: GameTheme; powerUps: boolean } = {
    target: 2,
    mode: 'fixed-target-score',
    theme: 'default',
    powerUps: false,
};

export const GAME_SETTINGS_MSGS = {
    target: `target must be ${TARGET_OPTIONS.join(', ')}`,
    mode: `mode must be one of ${MATCH_MODES.join(', ')}`,
    theme: `theme must be one of ${GAME_THEMES.join(', ')}`,
    powerUps: `powerUps must be a true or false`,
} as const;
