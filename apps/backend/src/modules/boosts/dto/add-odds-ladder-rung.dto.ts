import { IsNumber, Min } from 'class-validator';

export class AddOddsLadderRungDto {
  /** Decimal odds - must stay above 1.00 to remain a valid price. */
  @IsNumber()
  @Min(1.01)
  value!: number;
}
