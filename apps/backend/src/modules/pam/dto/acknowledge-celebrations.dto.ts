import { IsArray, IsString } from 'class-validator';

export class AcknowledgeCelebrationsDto {
  @IsArray()
  @IsString({ each: true })
  betIds!: string[];

  @IsArray()
  @IsString({ each: true })
  freebetGrantIds!: string[];
}
