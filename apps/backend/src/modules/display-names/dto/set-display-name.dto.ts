import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SetDisplayNameDto {
  /** null clears a previously-set override, reverting to the raw feed name. Omitted entirely is rejected by the controller (nothing to do). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string | null;
}
