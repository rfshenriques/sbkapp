import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class SetHomepageCarouselConfigDto {
  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(3)
  @Max(60)
  autoScrollSeconds!: number;
}
