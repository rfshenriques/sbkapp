import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TopNavIconKey, TopNavItemKind } from '@prisma/client';

/** Every field optional - staff sends only what's changing. */
export class UpdateTopNavItemDto {
  @IsOptional()
  @IsEnum(TopNavItemKind)
  kind?: TopNavItemKind;

  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsEnum(TopNavIconKey)
  icon?: TopNavIconKey;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sport?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  competition?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  matchId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  betAndGetCampaignId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  leaderboardCampaignId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
