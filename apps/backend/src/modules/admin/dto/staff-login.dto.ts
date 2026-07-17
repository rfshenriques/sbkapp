import { IsString, MinLength } from 'class-validator';

export class StaffLoginDto {
  /** Email or username. */
  @IsString()
  identifier!: string;

  @MinLength(8)
  password!: string;
}
