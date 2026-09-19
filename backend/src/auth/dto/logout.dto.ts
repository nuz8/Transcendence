import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @IsOptional()
  @IsString({ message: 'Refresh token must be a string' })
  refresh_token?: string;
}
