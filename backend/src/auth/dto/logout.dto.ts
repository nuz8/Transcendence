import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Optional refresh token to revoke during logout.'
  })
  @IsOptional()
  @IsString({ message: 'Refresh token must be a string' })
  refresh_token?: string;
}
