import { IsOptional, IsString, MinLength } from 'class-validator';

export class SuspendCompetitionDto {
  /** Must match Match.competition verbatim (the-odds-api.com's sport_title, e.g. "EPL"). */
  @IsString()
  @MinLength(1)
  competition!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
