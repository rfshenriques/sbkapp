import { IsISO8601, IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateMarketingSpendDto {
  /** The day the spend applies to, e.g. "2026-07-01". */
  @IsISO8601()
  date!: string;

  /** Free-text channel label (e.g. "Google Ads", "Affiliates") - not a fixed enum, spend channels vary per operator. */
  @IsString()
  @MinLength(1)
  channel!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;
}
