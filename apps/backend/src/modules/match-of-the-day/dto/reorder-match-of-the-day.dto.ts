import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderMatchOfTheDayDto {
  /** Every Match of the day entry id for this brand, in the desired display order. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
