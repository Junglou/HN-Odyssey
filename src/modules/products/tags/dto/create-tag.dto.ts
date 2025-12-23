import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TagScope } from '../../../../common/enums/tag-scope.enum';

export class CreateTagDto {
  @IsNotEmpty({ message: 'Tên thẻ không được để trống' })
  @IsString()
  @MinLength(2, { message: 'Tên thẻ tối thiểu 2 ký tự' }) 
  @MaxLength(50, { message: 'Tên thẻ tối đa 50 ký tự' }) 
  @Matches(/^[^<>/\\]+$/, { message: 'Tên thẻ không được chứa ký tự đặc biệt' }) // AC8: Chống XSS
  name: string;

  @IsEnum(TagScope, { message: 'Phạm vi thẻ không hợp lệ' })
  scope: TagScope; 

  @IsOptional()
  @IsString()
  description?: string;

  // AC7: Cấu hình hiển thị
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, {
    message: 'Mã màu nền không hợp lệ (Hex code)',
  })
  bg_color?: string; // Ví dụ: #FF0000

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, {
    message: 'Mã màu chữ không hợp lệ (Hex code)',
  })
  text_color?: string; // Ví dụ: #FFFFFF
}
