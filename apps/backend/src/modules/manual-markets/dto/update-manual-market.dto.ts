import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, MinLength, ValidateNested } from 'class-validator';
import { ManualMarketSelectionDto } from './create-manual-market.dto';

export class UpdateManualMarketDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualMarketSelectionDto)
  selections!: ManualMarketSelectionDto[];
}
