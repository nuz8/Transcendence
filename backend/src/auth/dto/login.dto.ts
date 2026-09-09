import { IsEmail, IsNotEmpty} from 'class-validator';
import { Transform } from 'class-transformer';
import { AUTH_VALID_MSGS } from '../auth.constants';
export class LoginDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail({}, { message: AUTH_VALID_MSGS.EMAIL_VALID })
  email!: string;

  @IsNotEmpty({ message: AUTH_VALID_MSGS.PASSWORD_REQUIRED })
  password!: string;
}