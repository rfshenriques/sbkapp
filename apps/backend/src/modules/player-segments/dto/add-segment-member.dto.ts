import { IsString, MinLength } from 'class-validator';

export class AddSegmentMemberDto {
  /** The player's email or username - whichever the staff member has on hand. */
  @IsString()
  @MinLength(1)
  identifier!: string;
}
