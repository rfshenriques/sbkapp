import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class SetBoostDto {
  @IsString()
  @MinLength(1)
  matchId!: string;

  @IsString()
  @MinLength(1)
  marketId!: string;

  @IsString()
  @MinLength(1)
  selectionId!: string;

  /** How many rungs up the brand's odds ladder to climb from the selection's otherwise-current price. */
  @IsInt()
  @Min(1)
  ticks!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
