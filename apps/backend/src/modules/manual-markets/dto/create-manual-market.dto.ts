import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class ManualMarketSelectionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @Min(1.01)
  odds!: number;
}

export class CreateManualMarketDto {
  @IsString()
  @MinLength(1)
  matchId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualMarketSelectionDto)
  selections!: ManualMarketSelectionDto[];
}
