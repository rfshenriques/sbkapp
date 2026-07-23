import { IsBoolean, IsInt, IsNumber, Min } from 'class-validator';

export class SetAccaBoostConfigDto {
  @IsNumber()
  @Min(0)
  boostPercentPerLeg!: number;

  @IsInt()
  @Min(2)
  minSelections!: number;

  @IsNumber()
  @Min(1.01)
  minOddsPerLeg!: number;

  @IsBoolean()
  enabled!: boolean;
}
