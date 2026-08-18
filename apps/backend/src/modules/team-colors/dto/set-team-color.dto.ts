import { IsOptional, Matches } from 'class-validator';

export class SetTeamColorDto {
  /** null clears a previously-set color. Omitted entirely leaves it as-is (see the controller). */
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'colorHex must be a 6-digit hex color like #EF0107' })
  colorHex?: string | null;

  /** Shown on Match of the day's team badges (see TeamBadge in apps/frontend). null clears a previously-set acronym. Omitted entirely leaves it as-is. */
  @IsOptional()
  @Matches(/^[A-Z0-9]{3}$/, { message: 'acronym must be exactly 3 uppercase letters/digits, e.g. RMA' })
  acronym?: string | null;
}
