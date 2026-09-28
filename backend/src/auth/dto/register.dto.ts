import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AUTH_VALID_MSGS, AUTH_VALID_RULES } from '../auth.constants';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Username. Leading and trailing whitespace is removed, and letters are lowercased.',
    example: 'player_one',
    minLength: AUTH_VALID_RULES.USERNAME.MIN,
    maxLength: AUTH_VALID_RULES.USERNAME.MAX,
  })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString({ message: AUTH_VALID_MSGS.USERNAME_STRING })
  @IsNotEmpty({ message: AUTH_VALID_MSGS.USERNAME_REQUIRED })
  @Length(AUTH_VALID_RULES.USERNAME.MIN, AUTH_VALID_RULES.USERNAME.MAX,
    { message: AUTH_VALID_MSGS.USERNAME_LENGTH })
  username!: string;

  @ApiProperty({
    description: 'Account email. Leading and trailing whitespace is removed, and letters are lowercased.',
    example: 'player@example.com',
    format: 'email',
    maxLength: AUTH_VALID_RULES.EMAIL.MAX,
  })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail({}, { message: AUTH_VALID_MSGS.EMAIL_VALID })
  @MaxLength(AUTH_VALID_RULES.EMAIL.MAX,
    { message: AUTH_VALID_MSGS.EMAIL_MAX_LENGTH })
  email!: string;

  @ApiProperty({
    description: 'Password for the new account.',
    example: 'Game-player-2026',
    format: 'password',
    writeOnly: true,
    minLength: AUTH_VALID_RULES.PASSWORD.MIN,
    maxLength: AUTH_VALID_RULES.PASSWORD.MAX,
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password must not be empty' })
  @Length(AUTH_VALID_RULES.PASSWORD.MIN, AUTH_VALID_RULES.PASSWORD.MAX,
    { message: AUTH_VALID_MSGS.PASSWORD_LENGTH })
  password!: string;
}