import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class SyncTeamNamesDto {
  /** Team names as seen in the odds feed right now - existing rows are left untouched, only unseen names get created (with colorHex left null). */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  names!: string[];
}
