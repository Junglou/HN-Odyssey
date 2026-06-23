import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

class EditorElementDto {
  @IsString() id: string;
  @IsString() type: string;
  @IsNumber() x: number;
  @IsNumber() y: number;
  @IsNumber() width: number;
  @IsNumber() height: number;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() link?: string;
  @IsOptional() @IsString() tag?: string;
  @IsOptional() @IsNumber() rotate?: number;
  @IsOptional() @IsObject() style?: Record<string, any>;
}

class SectionConfigDto {
  @IsString() id: string;
  @IsString() pageId: string;
  @IsString() name: string;
  @IsOptional() @IsString() backgroundUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditorElementDto)
  elements: EditorElementDto[];
}

export class UpdatePageConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionConfigDto)
  sections: SectionConfigDto[];
}
