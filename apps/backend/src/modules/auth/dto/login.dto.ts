import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  /** Email or username. */
  @IsString()
  identifier!: string;

  @MinLength(8)
  password!: string;
}
