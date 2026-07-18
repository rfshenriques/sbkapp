import { IsString, MinLength } from 'class-validator';

export class MasterLoginDto {
  /** Email or username. */
  @IsString()
  identifier!: string;

  @MinLength(8)
  password!: string;
}
