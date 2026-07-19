import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsUrl,
  Matches,
  MinLength,
} from 'class-validator';
import { ThemeMode } from '@prisma/client';

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
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(ThemeMode)
  themeMode?: ThemeMode;

  @IsOptional()
  @IsHexColor()
  buttonColorHex?: string;

  @IsOptional()
  @IsHexColor()
  highlightColorHex?: string;

  @IsOptional()
  @IsHexColor()
  filterColorHex?: string;
}

export class UpdateBrandDto {
  @IsOptional()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { message: 'Domain must be a valid hostname' })
  domain?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(ThemeMode)
  themeMode?: ThemeMode;

  @IsOptional()
  @IsHexColor()
  buttonColorHex?: string;

  @IsOptional()
  @IsHexColor()
  highlightColorHex?: string;

  @IsOptional()
  @IsHexColor()
  filterColorHex?: string;
}

export class SetProductFlagDto {
  @IsBoolean()
  enabled!: boolean;
}
