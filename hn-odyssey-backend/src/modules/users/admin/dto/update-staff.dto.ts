import { PartialType } from '@nestjs/mapped-types';
import { CreateStaffDto } from './create-staff.dto';
import { IsOptional, IsString, MinLength, IsArray } from 'class-validator';
import { Role } from '../../../../common/enums/role.enum';

export class UpdateStaffDto extends PartialType(CreateStaffDto) {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string; // AC3: Chỉ nhập khi muốn đổi pass

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: Role[];

  @IsOptional()
  is_active?: boolean;
}
