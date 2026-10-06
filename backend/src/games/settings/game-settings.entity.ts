import type { MatchMode } from '../match/match.types';
import type { GameTheme } from './game-settings.constants';

export type GameSettingsChoices = Omit<GameSettingsAttributes, 'userId' | 'gameId'>;

export type GameSettingsAttributes = {
    userId: string;
    gameId: string;
    target: number;
    mode: MatchMode;
    theme: GameTheme;
    powerUps: boolean;
};

export class GameSettingsEntity {
    userId: string;
    gameId: string;
    target: number;
    mode: MatchMode;
    theme: GameTheme;
    powerUps: boolean;

    constructor(attrs: GameSettingsAttributes) {
        this.userId = attrs.userId;
        this.gameId = attrs.gameId;
        this.target = attrs.target;
        this.mode = attrs.mode;
        this.theme = attrs.theme;
        this.powerUps = attrs.powerUps;
    }

    toPublicData() {
        return {
            gameId: this.gameId,
            target: this.target,
            mode: this.mode,
            theme: this.theme,
            powerUps: this.powerUps,
        };
    }
}
