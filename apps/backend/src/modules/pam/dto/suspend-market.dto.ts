import { IsOptional, IsString } from 'class-validator';

export class SuspendMarketDto {
  @IsString()
  matchId!: string;

  /** Omit to suspend the whole match (every market on it). */
  @IsOptional()
  @IsString()
  marketId?: string;

  /** Omit (with a marketId) to suspend the whole market. Requires marketId. */
  @IsOptional()
  @IsString()
  selectionId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
