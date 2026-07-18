import { IsOptional, IsString } from 'class-validator';

export class SuspendMarketDto {
  @IsString()
  matchId!: string;

  /** Omit to suspend the whole match (every market on it). */
  @IsOptional()
  @IsString()
  marketId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
