import { BetStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListBetsQueryDto {
  @IsOptional()
  @IsEnum(BetStatus)
  status?: BetStatus;
}
