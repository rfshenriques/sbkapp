import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsString, MinLength, ValidateNested } from 'class-validator';
import type { BetAndGetScopeType } from '@prisma/client';

const SCOPE_TYPES: BetAndGetScopeType[] = ['SPORT', 'COMPETITION', 'MATCH'];

export class CampaignScopeEntryDto {
  @IsIn(SCOPE_TYPES)
  scopeType!: BetAndGetScopeType;

  @IsString()
  @MinLength(1)
  scopeValue!: string;
}

/** Always the full replacement set - see BetAndGetCampaignService.setScopes. */
export class SetCampaignScopesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CampaignScopeEntryDto)
  scopes!: CampaignScopeEntryDto[];
}
