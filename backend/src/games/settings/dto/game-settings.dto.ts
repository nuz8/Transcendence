import { IsIn, IsBoolean } from 'class-validator';
import { MATCH_MODES, type MatchMode } from '../../match/match.types';
import { TARGET_OPTIONS, GAME_SETTINGS_MSGS, GAME_THEMES, type GameTheme } from '../game-settings.constants';
import { ApiProperty } from '@nestjs/swagger';

export class GameSettingsDto {
    @ApiProperty({ enum: [...TARGET_OPTIONS], example: 2, description: 'Rounds to play (fixed-rounds) or score to reach (fixed-target-score).' })
    @IsIn(TARGET_OPTIONS, { message: GAME_SETTINGS_MSGS.target })
    target: number;

    @ApiProperty({ enum: [...MATCH_MODES], example: 'fixed-target-score', description: '`fixed-target-score`: first to the target; drawn rounds are replayed. `fixed-rounds`: exactly the target number of rounds; draws count; can end drawn.' })
    @IsIn(MATCH_MODES, { message: GAME_SETTINGS_MSGS.mode })
    mode: MatchMode;

    @ApiProperty({ enum: [...GAME_THEMES], example: 'default', description: 'How the game page looks. The queue ignores it.' })
    @IsIn(GAME_THEMES, { message: GAME_SETTINGS_MSGS.theme })
    theme: GameTheme;

    @ApiProperty({ example: false, description: 'One shield and one double per player per match. Only players with the same choice are paired.' })
    @IsBoolean({ message: GAME_SETTINGS_MSGS.powerUps })
    powerUps: boolean;
}
