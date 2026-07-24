import { IsInt, IsString, MinLength } from 'class-validator';

export class SetCompetitionQuicklinkDto {
  /** Must match Match.competition verbatim (the-odds-api.com's sport_title, e.g. "EPL"). */
  @IsString()
  @MinLength(1)
  competition!: string;

  /** Lower shows first. Unlisted competitions never appear in the quicklinks section. */
  @IsInt()
  order!: number;
}
