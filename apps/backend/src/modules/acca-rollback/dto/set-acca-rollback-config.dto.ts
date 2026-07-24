import { IsBoolean, IsInt, IsNumber, Max, Min } from 'class-validator';

export class SetAccaRollbackConfigDto {
  @IsInt()
  @Min(2)
  minSelections!: number;

  @IsInt()
  @Min(1)
  lossThreshold!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  rewardPercent!: number;

  @IsBoolean()
  enabled!: boolean;
}
