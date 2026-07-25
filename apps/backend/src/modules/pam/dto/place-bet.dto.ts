import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
   * When true, this bet draws stakeCents from the player's pooled freebets
   * balance instead of their cash balance (see FreebetService.
   * spendFromBalance) - any typed amount up to that balance, not a fixed
   * token value. Acca boost never applies (see PamService.placeBet) to
   * avoid double-bonusing.
   */
  @IsOptional()
  @IsBoolean()
  useFreebets?: boolean;

  /**
   * When true and the brand has insurance bet enabled, the potential payout
   * is reduced up front by the configured cost percent (see
   * InsuranceBetConfig); if the bet then loses, the stake comes back as a
   * freebet. Never applies on a freebet-funded bet, to avoid
   * double-bonusing.
   */
  @IsOptional()
  @IsBoolean()
  insuranceOptIn?: boolean;
}
