import {
	IsEmail,
	IsNotEmpty,
	IsString,
	MaxLength,
	Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AUTH_VALID_MSGS, AUTH_VALID_RULES } from '../auth.constants';

export class RegisterDto {
	@Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
	@IsString({ message: AUTH_VALID_MSGS.USERNAME_STRING })
	@IsNotEmpty({ message: AUTH_VALID_MSGS.USERNAME_REQUIRED })
	@Length(AUTH_VALID_RULES.USERNAME.MIN, AUTH_VALID_RULES.USERNAME.MAX,
		{ message: AUTH_VALID_MSGS.USERNAME_LENGTH })
	username!: string;

	@Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
	@IsEmail({}, { message: AUTH_VALID_MSGS.EMAIL_VALID })
	@MaxLength(AUTH_VALID_RULES.EMAIL.MAX,
		{ message: AUTH_VALID_MSGS.EMAIL_MAX_LENGTH })
	email!: string;

	@IsString({ message: 'Password must be a string' })
	@IsNotEmpty({ message: 'Password must not be empty' })
	@Length(AUTH_VALID_RULES.PASSWORD.MIN, AUTH_VALID_RULES.PASSWORD.MAX,
		{ message: AUTH_VALID_MSGS.PASSWORD_LENGTH })
	password!: string;
}