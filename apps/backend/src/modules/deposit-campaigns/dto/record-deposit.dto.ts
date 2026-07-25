import { IsInt, IsPositive } from 'class-validator';

export class RecordDepositDto {
  @IsInt()
  @IsPositive()
  amountCents!: number;
}
