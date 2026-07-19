import { IsInt, IsString, MinLength } from 'class-validator';

export class SetCompetitionRankingDto {
  /** Must match Match.competition verbatim (the-odds-api.com's sport_title, e.g. "EPL"). */
  @IsString()
  @MinLength(1)
  competition!: string;

  /** Lower shows first. Unranked competitions sort after every ranked one. */
  @IsInt()
  rank!: number;
}
