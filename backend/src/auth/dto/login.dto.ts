import { IsEmail, IsNotEmpty} from 'class-validator';
import { Transform } from 'class-transformer';
import { AUTH_VALID_MSGS } from '../auth.constants';
import { ApiProperty } from '@nestjs/swagger';
export class LoginDto {
  @ApiProperty({
    description: 'Account email address.',
    example: 'player@example.com',
    format: 'email',
  })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail({}, { message: AUTH_VALID_MSGS.EMAIL_VALID })
  email!: string;

  @ApiProperty({
    description: 'Account password.',
    example: 'Example-password-123',
    format: 'password',
    writeOnly: true,
  })
  @IsNotEmpty({ message: AUTH_VALID_MSGS.PASSWORD_REQUIRED })
  password!: string;
}