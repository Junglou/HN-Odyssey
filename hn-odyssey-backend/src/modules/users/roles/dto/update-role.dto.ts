import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './create-role.dto';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUppercase,
} from 'class-validator';
import { RoleLevel } from 'src/common/enums/role-level.enum';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
  @IsOptional()
  @IsString()
  @IsUppercase()
  slug?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsEnum(RoleLevel)
  level?: RoleLevel;
}
