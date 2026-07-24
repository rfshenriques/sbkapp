import { IsBoolean, IsNumber, Max, Min } from 'class-validator';

export class SetInsuranceBetConfigDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  costPercent!: number;

  @IsBoolean()
  enabled!: boolean;
}
