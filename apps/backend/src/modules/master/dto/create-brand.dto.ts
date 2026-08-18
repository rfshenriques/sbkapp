import { IsBoolean, IsEnum, IsOptional, Matches, MinLength } from 'class-validator';
import { ThemeMode, TimeFormat } from '@prisma/client';
import type { ColorZone } from './brand-color';
import { IsColorZone } from './is-color-zone';
import { IsUrlOrOwnLogoPath } from './is-url-or-own-logo-path';

export class CreateBrandDto {
  @MinLength(2)
  name!: string;

  @Matches(/^[a-z0-9-]{2,40}$/, {
    message: 'Slug must be 2-40 characters: lowercase letters, numbers, or hyphens only',
  })
  slug!: string;

  @IsOptional()
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { message: 'Domain must be a valid hostname' })
  domain?: string;

  @IsOptional()
  @IsUrlOrOwnLogoPath()
  logoLightUrl?: string;

  @IsOptional()
  @IsUrlOrOwnLogoPath()
  logoDarkUrl?: string;

  @IsOptional()
  @IsUrlOrOwnLogoPath()
  shareLogoLightUrl?: string;

  @IsOptional()
  @IsUrlOrOwnLogoPath()
  shareLogoDarkUrl?: string;

  @IsOptional()
  @IsEnum(ThemeMode)
  themeMode?: ThemeMode;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'Currency code must be a 3-letter ISO 4217 code, e.g. EUR' })
  currencyCode?: string;

  @IsOptional()
  @IsEnum(TimeFormat)
  timeFormat?: TimeFormat;

  @IsOptional()
  @IsColorZone()
  backgroundColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  surfaceColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  buttonColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  highlightColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  filterColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  textColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  freebetBadgeColor?: ColorZone;
}

export class UpdateBrandDto {
  @IsOptional()
  @IsBoolean()
  freebetStakeReturnedOnWin?: boolean;

  @IsOptional()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { message: 'Domain must be a valid hostname' })
  domain?: string;

  @IsOptional()
  @IsUrlOrOwnLogoPath()
  logoLightUrl?: string;

  @IsOptional()
  @IsUrlOrOwnLogoPath()
  logoDarkUrl?: string;

  @IsOptional()
  @IsUrlOrOwnLogoPath()
  shareLogoLightUrl?: string;

  @IsOptional()
  @IsUrlOrOwnLogoPath()
  shareLogoDarkUrl?: string;

  @IsOptional()
  @IsEnum(ThemeMode)
  themeMode?: ThemeMode;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'Currency code must be a 3-letter ISO 4217 code, e.g. EUR' })
  currencyCode?: string;

  @IsOptional()
  @IsEnum(TimeFormat)
  timeFormat?: TimeFormat;

  @IsOptional()
  @IsColorZone()
  backgroundColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  surfaceColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  buttonColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  highlightColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  filterColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  textColor?: ColorZone;

  @IsOptional()
  @IsColorZone()
  freebetBadgeColor?: ColorZone;
}

export class SetProductFlagDto {
  @IsBoolean()
  enabled!: boolean;
}
