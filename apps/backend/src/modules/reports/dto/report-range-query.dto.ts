import { IsISO8601, IsOptional } from 'class-validator';

export class ReportRangeQueryDto {
  /** Inclusive start of the range, e.g. "2026-07-01". Omit for no lower bound. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive end of the range. Omit for no upper bound. */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
