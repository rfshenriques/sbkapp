import { IsOptional, Matches } from 'class-validator';

export class SetTeamColorDto {
  /** null clears a previously-set color. Omitted entirely is rejected by the controller (nothing to do). */
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'colorHex must be a 6-digit hex color like #EF0107' })
  colorHex?: string | null;
}
