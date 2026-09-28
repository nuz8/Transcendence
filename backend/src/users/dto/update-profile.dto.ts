import { Transform } from 'class-transformer';
import { IsString, Length, ValidateIf } from 'class-validator';
import { AUTH_VALID_MSGS, AUTH_VALID_RULES} from '../../auth/auth.constants';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'New username. Whitespace is trimmed and letters are lowercased.',
    example: 'player_two',
    minLength: AUTH_VALID_RULES.USERNAME.MIN,
    maxLength: AUTH_VALID_RULES.USERNAME.MAX,
  })
  @ValidateIf((o) => o.username !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString({ message: AUTH_VALID_MSGS.USERNAME_STRING })
  @Length(AUTH_VALID_RULES.USERNAME.MIN, AUTH_VALID_RULES.USERNAME.MAX, {
    message: AUTH_VALID_MSGS.USERNAME_LENGTH,
  })
  username?: string;
}