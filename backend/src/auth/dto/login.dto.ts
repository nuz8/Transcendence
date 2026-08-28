import { IsEmail, IsNotEmpty} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'Password must not be empty' })
  password: string;
}