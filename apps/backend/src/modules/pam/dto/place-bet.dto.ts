import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BetSelectionDto {
  @IsString()
  matchId!: string;

  @IsString()
  marketId!: string;

  @IsString()
  selectionId!: string;

  @IsString()
  matchLabel!: string;

  @IsString()
  marketName!: string;

  @IsString()
  selectionName!: string;

  @IsNumber()
  @IsPositive()
  odds!: number;
}

export class PlaceBetDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BetSelectionDto)
  selections!: BetSelectionDto[];

  /** Stake in cents, to avoid floating-point money. */
  @IsInt()
  @Min(1)
  stakeCents!: number;
}
