import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './create-role.dto';
import { IsBoolean, IsOptional, IsString, IsUppercase } from 'class-validator';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
  @IsOptional()
  @IsString()
  @IsUppercase()
  slug?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
