import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicUserResponseDto } from '../../users/dto/public-user-response.dto';

export class LoginResponseDto {
  @ApiProperty({ type: PublicUserResponseDto })
  user!: PublicUserResponseDto;

  @ApiProperty({ description: 'Access token for bearer authentication.' })
  access_token!: string;

  @ApiProperty({ description: 'Refresh token used to obtain a new token pair.' })
  refresh_token!: string;
}

export class RefreshResponseDto {
  @ApiProperty({ description: 'New access token for bearer authentication.' })
  access_token!: string;

  @ApiProperty({ description: 'Replacement refresh token.' })
  refresh_token!: string;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiPropertyOptional({
    description: 'Whether the supplied refresh token was revoked.',
  })
  refresh_token_revoked?: boolean;
}