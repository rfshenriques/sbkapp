import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export const ANALYTICS_EVENT_TYPES = [
  'PAGE_VIEW',
  'SEARCH',
  'CLICK',
  'LOGIN',
  'BET_PLACED',
  'BET_NOT_FINISHED',
] as const;

export type AnalyticsEventTypeValue = (typeof ANALYTICS_EVENT_TYPES)[number];

export class AnalyticsEventEntryDto {
  @IsIn(ANALYTICS_EVENT_TYPES)
  type!: AnalyticsEventTypeValue;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class IngestAnalyticsEventsDto {
  /**
   * The frontend already resolves its own brand at startup (see
   * useBrandTheme) before anything else can render, so it's cheaper to
   * send the already-resolved id than to make this endpoint redo
   * domain-based resolution on every request.
   */
  @IsString()
  brandId!: string;

  /** Client-generated anonymous id, kept across login/logout so one browsing session can be traced end to end. */
  @IsString()
  sessionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventEntryDto)
  events!: AnalyticsEventEntryDto[];
}
