import type { AudienceMode } from '@prisma/client';
import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const AUDIENCE_MODES: AudienceMode[] = ['ALL', 'SEGMENTS'];

/**
 * LOGGED_OUT is intentionally not offered here (unlike other AudienceMode
 * pickers) - a push subscription can't exist without a logged-in userId, so
 * it would always resolve to zero recipients. See
 * PlayerSegmentService.resolveUserIdsForAudience.
 */
export class SendPushNotificationDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  targetUrl?: string;

  @IsOptional()
  @IsIn(AUDIENCE_MODES)
  audienceMode?: AudienceMode;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segmentIds?: string[];

  @IsOptional()
  @IsString()
  betAndGetCampaignId?: string;

  @IsOptional()
  @IsString()
  depositCampaignId?: string;
}
