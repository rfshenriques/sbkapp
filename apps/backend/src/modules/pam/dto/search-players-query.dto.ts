import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchPlayersQueryDto {
  /** Case-insensitive substring match against email, username, or phone. Omit to list every player, most recent first. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  query?: string;
}
