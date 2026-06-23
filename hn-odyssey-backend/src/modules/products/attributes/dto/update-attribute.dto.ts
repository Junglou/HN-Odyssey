import { PartialType } from '@nestjs/mapped-types';
import { CreateAttributeDto } from './create-attribute.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAttributeDto extends PartialType(CreateAttributeDto) {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
