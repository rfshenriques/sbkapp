import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderTopNavItemsDto {
  /** Every top nav item id for this brand, in the desired display order. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
