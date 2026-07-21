import { IsIn, IsString, MinLength } from 'class-validator';

export class SetCompetitionTierDto {
  /** Must match Match.competition verbatim (the-odds-api.com's sport_title, e.g. "EPL"). */
  @IsString()
  @MinLength(1)
  competition!: string;

  @IsIn([1, 2, 3, 4])
  tier!: number;
}
