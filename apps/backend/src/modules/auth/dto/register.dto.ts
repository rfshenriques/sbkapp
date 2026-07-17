import { IsEmail, IsPhoneNumber, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'Username must be 3-20 characters: letters, numbers, or underscores only',
  })
  username!: string;

  @IsPhoneNumber(undefined, {
    message: 'Phone must be a valid international number, e.g. +15551234567',
  })
  phone!: string;

  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;
}
