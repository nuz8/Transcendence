import { ApiProperty } from '@nestjs/swagger';
import { MATCH_MODES, type MatchMode } from '../../match/match.types';
import { GAME_THEMES, type GameTheme, TARGET_OPTIONS } from '../game-settings.constants';

export class GameSettingsResponseDto {
    @ApiProperty({ format: 'uuid' })
    gameId!: string;

    @ApiProperty({ enum: [...TARGET_OPTIONS], example: 2 })
    target!: number;

    @ApiProperty({ enum: [...MATCH_MODES], example: 'fixed-target-score' })
    mode!: MatchMode;

    @ApiProperty({ enum: [...GAME_THEMES], example: 'default' })
    theme!: GameTheme;

    @ApiProperty({ example: false })
    powerUps!: boolean;
}
