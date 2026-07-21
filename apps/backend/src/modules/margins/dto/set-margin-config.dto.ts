import { IsIn, IsNumber, IsString, Max, Min, MinLength } from 'class-validator';

export class SetMarginConfigDto {
  /** Raw feed market name (e.g. "Match Result") - must match Market.name verbatim. */
  @IsString()
  @MinLength(1)
  marketName!: string;

  @IsIn([1, 2, 3, 4])
  tier!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  marginPercent!: number;
}
