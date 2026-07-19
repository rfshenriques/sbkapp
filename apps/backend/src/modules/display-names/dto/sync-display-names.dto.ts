import { DisplayNameEntityType } from '@prisma/client';
import { ArrayNotEmpty, IsArray, IsEnum, IsString } from 'class-validator';

export class SyncDisplayNamesDto {
  @IsEnum(DisplayNameEntityType)
  entityType!: DisplayNameEntityType;

  /** Raw names as seen in the odds feed right now - existing rows are left untouched, only unseen names get created (with displayName left null). */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  names!: string[];
}
