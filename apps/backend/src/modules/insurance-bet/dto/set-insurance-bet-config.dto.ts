import { IsBoolean, IsNumber, Max, Min } from 'class-validator';

export class SetInsuranceBetConfigDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  costPercent!: number;

  @IsBoolean()
  enabled!: boolean;

  /** Insurance only offered/accepted on a bet whose combined odds are at least this. */
  @IsNumber()
  @Min(1)
  minOdds!: number;
}
