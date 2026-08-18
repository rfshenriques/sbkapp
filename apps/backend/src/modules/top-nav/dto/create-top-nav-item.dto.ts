import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TopNavIconKey, TopNavItemKind } from '@prisma/client';

export class CreateTopNavItemDto {
  @IsEnum(TopNavItemKind)
  kind!: TopNavItemKind;

  @IsString()
  @MinLength(1)
  label!: string;

  /** Freely staff-chosen, independent of kind - defaults to the schema's own default (STAR) when omitted. */
  @IsOptional()
  @IsEnum(TopNavIconKey)
  icon?: TopNavIconKey;

  /** Required (and only meaningful) for kind SPORT - validated against `kind` in TopNavItemService, not here. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  sport?: string;

  /** Required (and only meaningful) for kind COMPETITION. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  competition?: string;

  /** Required (and only meaningful) for kind MATCH. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  matchId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
