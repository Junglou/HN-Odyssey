import { PartialType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';
import { CreateStaticPageDto } from './create-static-page.dto';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { MenuPosition } from '../schemas/menu-config.schema';

export class UpdatePostDto extends PartialType(CreatePostDto) {}
export class UpdateStaticPageDto extends PartialType(CreateStaticPageDto) {}

export class CreateMenuDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  link: string;

  @IsEnum(MenuPosition)
  @IsNotEmpty()
  position: MenuPosition;

  @IsOptional()
  @IsString()
  parent_id?: string;

  @IsOptional()
  @IsInt()
  display_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateMenuDto extends PartialType(CreateMenuDto) {}
