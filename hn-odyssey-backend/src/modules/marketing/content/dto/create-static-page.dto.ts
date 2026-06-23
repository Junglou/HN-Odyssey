import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PageStatus } from '../schemas/static-page.schema';

export class CreateStaticPageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang',
  })
  slug: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  meta_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  meta_description?: string;

  @IsOptional()
  @IsEnum(PageStatus)
  status?: PageStatus;
}
