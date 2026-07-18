import { IsString } from 'class-validator';
import { CreateStaffUserDto } from './create-staff-user.dto';

export class BootstrapStaffUserDto extends CreateStaffUserDto {
  /** Which brand this is the first staff account for. */
  @IsString()
  brandId!: string;
}
