import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderPromoCardsDto {
  /** Every promo card id for this brand, in the desired display order. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
