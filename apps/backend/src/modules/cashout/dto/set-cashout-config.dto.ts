import { IsBoolean, IsNumber, Max, Min } from 'class-validator';

export class SetCashoutConfigDto {
  @IsBoolean()
  enabled!: boolean;

  @IsNumber()
  @Min(0)
  @Max(100)
  marginPercent!: number;
}
