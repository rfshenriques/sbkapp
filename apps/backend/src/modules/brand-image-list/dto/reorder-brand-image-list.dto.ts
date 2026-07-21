import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderBrandImageListDto {
  /** Every item id for this brand+kind, in the desired display order. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
