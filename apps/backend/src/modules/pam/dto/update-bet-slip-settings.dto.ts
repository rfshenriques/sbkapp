import { ArrayMinSize, ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateBetSlipSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoUpdateOdds?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsInt({ each: true })
  @Min(1, { each: true })
  quickStakeCents?: number[];
}
