import { IsInt, IsISO8601, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class GrantFreebetDto {
  /** The player's email or username - whichever the staff member has on hand. */
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsInt()
  @IsPositive()
  amountCents!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
