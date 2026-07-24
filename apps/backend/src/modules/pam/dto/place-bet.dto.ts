import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
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

  /**
   * When set, this bet is funded by that freebet grant instead of the
   * player's cash balance - stakeCents must equal the grant's own
   * amountCents exactly (a freebet is atomic, see FreebetService), and acca
   * boost never applies (see PamService.placeBet) to avoid double-bonusing.
   */
  @IsOptional()
  @IsString()
  freebetGrantId?: string;
}
