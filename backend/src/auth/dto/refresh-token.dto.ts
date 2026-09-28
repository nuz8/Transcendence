import { IsNotEmpty, IsString } from 'class-validator';
import { AUTH_VALID_MSGS } from '../auth.constants';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token returned by the login or refresh endpoint.',
    minLength: 1,
  })
  @IsNotEmpty({ message: AUTH_VALID_MSGS.REFRESH_TOKEN_REQUIRED })
  @IsString({ message: AUTH_VALID_MSGS.REFRESH_TOKEN_STRING })
  refresh_token!: string;
}