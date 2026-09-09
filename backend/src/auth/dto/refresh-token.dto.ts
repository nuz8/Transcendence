import { IsNotEmpty, IsString } from 'class-validator';
import { AUTH_VALID_MSGS } from '../auth.constants';

export class RefreshTokenDto {
  @IsNotEmpty({ message: AUTH_VALID_MSGS.REFRESH_TOKEN_REQUIRED })
  @IsString({ message: AUTH_VALID_MSGS.REFRESH_TOKEN_STRING })
  refresh_token!: string;
}