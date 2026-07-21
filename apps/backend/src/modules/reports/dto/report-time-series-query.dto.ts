import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import type { ReportGranularity } from '../reports.service';

const GRANULARITIES: ReportGranularity[] = ['day', 'week', 'month'];

export class ReportTimeSeriesQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsIn(GRANULARITIES)
  granularity!: ReportGranularity;
}
