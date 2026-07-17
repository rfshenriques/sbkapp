import { SelectionStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SettleSelectionDto {
  @IsEnum(SelectionStatus)
  status!: SelectionStatus;
}
